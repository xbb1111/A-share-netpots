import { afterEach, expect, it, vi } from 'vitest';
import { SnapshotRefresh } from './snapshot-refresh.mjs';

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

it('coalesces requests across panels and keeps a terminal result across reloads', async () => {
  const records = new Map();
  const tx = { get: (key) => records.get(key), put: (key, value) => records.set(key, value) };
  const storage = { transaction: (action) => action(tx) };
  const request = async (method) => (await new SnapshotRefresh({ storage }).fetch(new Request('https://site.test/api/snapshot-refresh', { method }))).json();
  const runs = [];
  const lookup = vi.fn(async () => Response.json({ workflow_runs: runs }));
  vi.stubGlobal('fetch', lookup);
  vi.useFakeTimers();
  expect((await request('GET')).status).toBe('idle');
  const job = await request('POST');
  expect(job.status).toBe('queued');
  expect((await request('POST')).id).toBe(job.id);
  expect(lookup).toHaveBeenCalledTimes(1);
  runs.push({ display_title: 'Website refresh ' + job.id, id: 123, status: 'in_progress' });
  vi.advanceTimersByTime(100_000);
  expect((await request('GET')).status).toBe('running');
  Object.assign(runs[0], { status: 'completed', conclusion: 'success' });
  vi.advanceTimersByTime(100_000);
  expect((await request('GET')).status).toBe('completed');
  vi.advanceTimersByTime(2 * 60 * 60_000);
  expect((await request('GET')).status).toBe('completed');
  expect((await request('POST')).id).not.toBe(job.id);
});

it('preserves the request when the run status service is unavailable', async () => {
  const records = new Map();
  const storage = { transaction: (action) => action({ get: (key) => records.get(key), put: (key, value) => records.set(key, value) }) };
  vi.stubGlobal('fetch', async () => new Response(null, { status: 503 }));
  vi.useFakeTimers();
  const queue = new SnapshotRefresh({ storage });
  const request = async (method) => (await queue.fetch(new Request('https://site.test', { method }))).json();
  const job = await request('POST');
  expect(job.status).toBe('unknown');
  expect((await request('GET')).id).toBe(job.id);
  vi.advanceTimersByTime(2 * 60 * 60_000);
  expect((await request('GET')).status).toBe('expired');
});
