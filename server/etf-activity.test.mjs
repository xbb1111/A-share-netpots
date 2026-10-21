import { describe, expect, it, vi } from 'vitest';
import { ACTIVITY_ETFS, createEtfActivityService, parseEtfAmounts, refreshEtfActivity } from './etf-activity.mjs';
import { ETF_ACTIVITY_SEED } from './etf-activity-seed.mjs';

const rows = Array.from({ length: 20 }, (_, index) => `2026-09-${String(index + 1).padStart(2, '0')},1,1,1,1,100,200000000,0`);
const payload = (code) => ({ rc: 0, data: { code, klines: rows } });
const seed = { histories: ACTIVITY_ETFS.map((etf) => ({ ...etf, bars: [{ time: '2026-09-19', amount: 100000000 }], updatedAt: '2026-09-19T08:00:00Z' })) };

describe('ETF turnover service', () => {
  it('ships verified fallback turnover for all ten ETFs with enough comparison history', () => {
    expect(ETF_ACTIVITY_SEED.histories).toHaveLength(10);
    for (const etf of ACTIVITY_ETFS) {
      const item = ETF_ACTIVITY_SEED.histories.find((value) => value.code === etf.code);
      expect(item.bars.length).toBeGreaterThanOrEqual(20);
      expect(item.bars.every((bar) => bar.amount > 0)).toBe(true);
    }
  });

  it('rejects price-only fallback responses and mismatched securities', () => {
    expect(() => parseEtfAmounts({ rc: 0, data: { code: '510300', klines: rows.map((row) => row.replace('200000000', '0')) } }, '510300')).toThrow('历史不足');
    expect(() => parseEtfAmounts(payload('510300'), '510050')).toThrow('无效');
  });

  it('uses the alternate route when the other route has no turnover', async () => {
    const next = await refreshEtfActivity(seed, { fetcher: async (url) => {
      const parsed = new URL(url);
      const code = parsed.searchParams.get('secid').slice(2);
      return { ok: true, json: async () => parsed.hostname.startsWith('61.') ? { rc: 0, data: { code, klines: [] } } : payload(code) };
    } });
    expect(next.histories.every((item) => !item.cached && item.bars.length === 20)).toBe(true);
    expect(next.histories[0].bars.at(-1).amount).toBe(200000000);
  });

  it('retains valid history and its original update time when all sources fail', async () => {
    const next = await refreshEtfActivity(seed, { fetcher: async () => { throw new Error('upstream down'); } });
    expect(next.histories[0].bars).toEqual(seed.histories[0].bars);
    expect(next.histories[0].updatedAt).toBe(seed.histories[0].updatedAt);
    expect(next.histories.every((item) => item.cached)).toBe(true);
  });

  it('deduplicates simultaneous refreshes and serves its short cache', async () => {
    const fetcher = vi.fn(async (url) => ({ ok: true, json: async () => payload(new URL(url).searchParams.get('secid').slice(2)) }));
    const service = createEtfActivityService(seed, { fetcher });
    const [first, second] = await Promise.all([service(), service(true)]);
    expect(first).toBe(second);
    expect(await service()).toBe(first);
    expect(fetcher).toHaveBeenCalledTimes(20);
  });
});
