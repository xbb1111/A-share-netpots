import { afterEach, expect, it, vi } from 'vitest';
import { SnapshotRefresh } from './snapshot-refresh.mjs';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

function createClient() {
  const records = new Map();
  const tx = { get: (key) => records.get(key), put: (key, value) => records.set(key, value) };
  const storage = { transaction: (action) => action(tx) };
  return async (method, report) => new SnapshotRefresh({ storage }).fetch(new Request(
    'https://site.test/api/snapshot-refresh' + (report ? '/report' : ''),
    { method, body: report ? JSON.stringify(report) : undefined },
  ));
}

it('coalesces requests across panels and keeps a terminal result across reloads', async () => {
  vi.useFakeTimers();
  const request = createClient();
  expect((await (await request('GET')).json()).status).toBe('idle');
  const job = await (await request('POST')).json();
  expect(job.status).toBe('queued');
  expect((await (await request('POST')).json()).id).toBe(job.id);
  const report = { id: job.id, runId: '123', status: 'running' };
  expect((await request('POST', report)).status).toBe(204);
  expect((await (await request('GET')).json()).status).toBe('running');
  expect((await request('POST', { ...report, runId: '456' })).status).toBe(409);
  expect((await request('POST', { ...report, status: 'completed' })).status).toBe(204);
  await request('POST', report);
  vi.advanceTimersByTime(2 * 60 * 60_000);
  expect((await (await request('GET')).json()).status).toBe('completed');
  expect((await (await request('POST')).json()).id).not.toBe(job.id);
  expect((await request('POST', report)).status).toBe(409);
});

it('expires a request that was never acknowledged', async () => {
  vi.useFakeTimers();
  const request = createClient();
  await request('POST');
  vi.advanceTimersByTime(2 * 60 * 60_000);
  expect((await (await request('GET')).json()).status).toBe('expired');
});

it('rejects anonymous status changes before accessing the queue', async () => {
  const { default: worker } = await import('./financial-report-worker.mjs');
  const response = await worker.fetch(new Request('https://site.test/api/snapshot-refresh/report', { method: 'POST' }), {});
  expect(response.status).toBe(401);
});
