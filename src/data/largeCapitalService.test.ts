import { describe, expect, it } from 'vitest';
import { capitalWindow, fetchLargeCapitalSnapshot, sortCapitalMembers, type CapitalMember } from './largeCapitalService';

describe('large capital service', () => {
  it('loads the deployed snapshot endpoint', async () => {
    const urls: string[] = [];
    const payload = { version: 1, asOf: '2026-04-01', updatedAt: 'now', stale: false, status: '中性', methodology: 'test', nationalTeam: {}, institutions: {} };
    const result = await fetchLargeCapitalSnapshot(async (url) => { urls.push(url); return { ok: true, json: async () => payload }; });
    expect(urls[0]).toContain('/api/large-capital-flows');
    expect(result.asOf).toBe('2026-04-01');
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
});
