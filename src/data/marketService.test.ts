import { describe, expect, it, vi } from 'vitest';
import { EASTMONEY_SOURCE_NAME, getDashboardData } from './marketService';

describe('getDashboardData', () => {
  it('stops waiting for stalled market endpoints', async () => {
    vi.useFakeTimers();
    const fetcher = async () => new Promise<Pick<Response, 'ok' | 'json'>>(() => {});

    const pendingData = getDashboardData({
      fetcher,
      now: new Date('2026-06-29T10:30:00+08:00'),
      timeoutMs: 100,
    });
    await vi.advanceTimersByTimeAsync(100);

    await expect(pendingData).resolves.toMatchObject({ industries: [], watchlist: [] });
    vi.useRealTimers();
  });

  it('keeps industry data available when the stock endpoint is temporarily unavailable', async () => {
    const fetcher = async (url: string) => {
      if (url.includes('/api/market-stocks')) throw new Error('stock endpoint unavailable');
      return { ok: true, json: async () => ({ data: { diff: [{ f12: 'BK1030', f14: '电池', f3: 1.2, f62: 100000000, f104: 30, f128: '示例公司' }] } }) };
    };

    const data = await getDashboardData({ fetcher, now: new Date('2026-06-29T10:30:00+08:00') });

    expect(data.industries).toHaveLength(1);
    expect(data.watchlist).toHaveLength(0);
    expect(data.overview[0].value).toBe('—');
    expect(data.overview[3].value).toBe('—');
    expect(data.displaySource).toBe('部分行情可用');
  });

  it('builds the dashboard from live market API responses instead of static fixtures', async () => {
    const requestedUrls: string[] = [];
    const fetcher = async (url: string) => {
      requestedUrls.push(url);

      const payload = url.includes('/api/industry-boards')
        ? {
            data: {
              diff: [
                { f12: 'BK1030', f14: '电源设备', f3: 2.56, f62: 1840000000, f104: 85, f128: '宁德时代', f140: '300750' },
                { f12: 'BK0737', f14: '半导体', f3: 0.74, f62: 860000000, f104: 72, f128: '中芯国际', f140: '688981' },
              ],
            },
          }
        : {
            data: {
              diff: [
                { f12: '300750', f14: '宁德时代', f2: 218.6, f3: 2.41, f62: 920000000, f100: '电源设备' },
                { f12: '688981', f14: '中芯国际', f2: 62.12, f3: 0.74, f62: 330000000, f100: '半导体' },
              ],
            },
          };

      return { ok: true, json: async () => payload };
    };

    const data = await getDashboardData({ fetcher, now: new Date('2026-06-29T10:30:00+08:00') });

    expect(data.overview).toHaveLength(4);
    expect(data.industries).toHaveLength(2);
    expect(data.watchlist).toHaveLength(2);
    expect(data.alerts.length).toBeGreaterThanOrEqual(2);
    expect(data.marketCalendar.length).toBeGreaterThanOrEqual(3);
    expect(data.watchlist.every((stock) => stock.score >= 0 && stock.score <= 100)).toBe(true);
    expect(data.industries.every((industry) => industry.heat >= 0 && industry.heat <= 100)).toBe(true);
    expect(data.watchlist[0]).toMatchObject({
      code: '300750',
      name: '宁德时代',
      industry: '电源设备',
      price: 218.6,
      change: 2.41,
    });
    expect(data.industries[0]).toMatchObject({
      name: '电源设备',
      capitalFlow: 18.4,
      trend: 'up',
    });
    expect(data.source).toBe(EASTMONEY_SOURCE_NAME);
    expect(requestedUrls).toHaveLength(2);
    expect(requestedUrls.every((url) => url.startsWith('/api/'))).toBe(true);
    expect(requestedUrls.find((url) => url.includes('/api/industry-boards'))).toContain('pz=100');
  });

  it('ranks valid candidates by signed flow and counts the actual high-priority queue', async () => {
    const stocks = [
      { f12: '000001', f14: '流出', f2: 10, f3: 0, f62: -100 },
      { f12: '000002', f14: '缺行情', f2: '-', f3: '-', f62: 300 },
      { f12: '000003', f14: '流入', f2: 10, f3: 0, f62: 100 },
    ];
    const boards = [
      { f12: 'BK1', f14: '第一', f3: -4, f62: 200, f104: 0 },
      { f12: 'BK2', f14: '第二', f3: 5, f62: 190, f104: 80 },
    ];
    const data = await getDashboardData({ fetcher: async (url) => ({
      ok: true, json: async () => ({ data: { diff: url.includes('industry-boards') ? boards : stocks } }),
    }) });
    expect(data.watchlist.map((stock) => stock.name)).toEqual(['流入', '流出']);
    expect(data.watchlist[0].score).toBeGreaterThan(data.watchlist[1].score);
    expect(data.overview[0].value).toBe('50');
    expect(data.overview[1].value).toBe('第二');
    expect(data.overview[2].value).toBe('1');
  });

  it('keeps vendor names out of user-visible data labels', async () => {
    const fetcher = async (url: string) => {
      const payload = url.includes('/api/industry-boards')
        ? { data: { diff: [{ f12: 'BK1030', f14: '电源设备', f3: 2.56, f62: 1840000000, f104: 85, f128: '宁德时代' }] } }
        : { data: { diff: [{ f12: '300750', f14: '宁德时代', f2: 218.6, f3: 2.41, f62: 920000000, f100: '电源设备' }] } };

      return { ok: true, json: async () => payload };
    };

    const data = await getDashboardData({ fetcher, now: new Date('2026-06-29T10:30:00+08:00') });
    const visibleText = [
      data.displaySource,
      ...data.overview.map((metric) => `${metric.label} ${metric.value} ${metric.detail}`),
      ...data.memos.map((memo) => `${memo.title} ${memo.body}`),
    ].join('\n');

    expect(data.source).toBe(EASTMONEY_SOURCE_NAME);
    expect(data.displaySource).toBe('实时行情');
    expect(visibleText).not.toContain('东方财富');
  });
});
