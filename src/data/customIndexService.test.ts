import { describe, expect, it } from 'vitest';
import { fetchCustomIndexData } from './customIndexService';

describe('custom index market data service', () => {
  it('loads histories and market caps for each component', async () => {
    const urls: string[] = [];
    const fetcher = async (input: string) => {
      urls.push(input);
      if (input.includes('stock/kline/get')) {
        return { ok: true, json: async () => ({ data: { code: '600000', name: '甲', klines: ['2026-01-02,10,10,10,10,1,1,0'] } }) };
      }
      return { ok: true, json: async () => ({ data: { f43: 1234, f162: 1850, f116: 123456789 } }) };
    };

    const result = await fetchCustomIndexData([{ code: '600000', name: '甲', industry: '金融' }], fetcher);

    expect(result.histories['600000']).toHaveLength(1);
    expect(result.marketCaps['600000']).toBe(123456789);
    expect(result.currentPrices['600000']).toBe(12.34);
    expect(result.currentPE['600000']).toBe(18.5);
    expect(urls).toHaveLength(2);
  });

  it('returns diagnostics when a component history is unavailable', async () => {
    const fetcher = async (input: string) => ({
      ok: true,
      json: async () => (input.includes('stock/kline/get') ? { data: { code: '000001', name: '乙', klines: [] } } : { data: {} }),
    });

    const result = await fetchCustomIndexData([{ code: '000001', name: '乙', industry: '银行' }], fetcher);

    expect(result.diagnostics).toEqual([
      { code: '000001', message: '历史行情不足' },
      { code: '000001', message: '市值数据不足' },
    ]);
  });

  it('loads an optional benchmark history', async () => {
    const fetcher = async (input: string) => ({
      ok: true,
      json: async () => (input.includes('stock/kline/get') ? { data: { code: '000300', name: '沪深300', klines: ['2026-01-02,10,10,10,10,1,1,0'] } } : { data: { f116: 1 } }),
    });

    const result = await fetchCustomIndexData([], fetcher, '000300');

    expect(result.benchmarkHistory?.['000300']).toHaveLength(1);
  });

  it('requests the configured intraday period and preserves timestamps', async () => {
    const urls: string[] = [];
    const fetcher = async (input: string) => {
      urls.push(input);
      return { ok: true, json: async () => (input.includes('stock/kline/get') ? { data: { code: '600000', name: '甲', klines: ['2026-07-10 10:30,10,11,12,9,1,1,0'] } } : { data: { f116: 1 } }) };
    };

    const result = await fetchCustomIndexData([{ code: '600000', name: '甲', industry: '金融' }], fetcher, undefined, '30m');

    expect(urls.some((url) => url.includes('klt=30'))).toBe(true);
    expect(result.histories['600000'][0].date).toBe('2026-07-10 10:30');
  });
});
