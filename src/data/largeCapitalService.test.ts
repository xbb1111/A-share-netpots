import { describe, expect, it } from 'vitest';
import { addNormalizedOverlays, capitalWindow, fetchLargeCapitalSnapshot, sortCapitalMembers, type CapitalMember } from './largeCapitalService';

describe('large capital service', () => {
  it('loads the deployed snapshot endpoint', async () => {
    const urls: string[] = [];
    const payload = { version: 1, asOf: '2026-04-01', updatedAt: 'now', stale: false, status: '中性', methodology: 'test', nationalTeam: {}, institutions: {} };
    const result = await fetchLargeCapitalSnapshot(async (url) => { urls.push(url); return { ok: true, json: async () => payload }; });
    expect(urls[0]).toContain('/api/large-capital-flows');
    expect(result.asOf).toBe('2026-04-01');
  });

  it('cache-busts an explicit latest-snapshot check', async () => {
    const urls: string[] = [];
    const payload = { version: 1, asOf: '2026-04-01', updatedAt: 'now', stale: false, status: '中性', methodology: 'test', nationalTeam: {}, institutions: {} };
    await fetchLargeCapitalSnapshot(async (url) => { urls.push(url); return { ok: true, json: async () => payload }; }, true);
    expect(urls[0]).toMatch(/\/api\/large-capital-flows\?refresh=\d+/);
  });

  it('limits chart windows and ranks disclosed member positions', () => {
    expect(capitalWindow([1, 2, 3, 4], 2)).toEqual([3, 4]);
    const members = [
      { name: '甲', long: 10, short: 3, net: 7 },
      { name: '乙', long: 5, short: 20, net: -15 },
    ] as CapitalMember[];
    expect(sortCapitalMembers(members, 'netLong')[0].name).toBe('甲');
    expect(sortCapitalMembers(members, 'netShort')[0].name).toBe('乙');
  });

  it('normalizes ETF and index overlays to the first common visible day', () => {
    const result = addNormalizedOverlays(
      [{ date: '2026-04-01', net: 1 }, { date: '2026-04-02', net: 2 }, { date: '2026-04-03', net: 3 }],
      [{ key: 'trend', series: [{ date: '2026-04-02', value: 200 }, { date: '2026-04-03', value: 210 }] }],
    );
    expect(result.map((point) => point.trend)).toEqual([null, 100, 105]);
  });
});
