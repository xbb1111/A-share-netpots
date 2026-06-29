import { describe, expect, it } from 'vitest';
import { EASTMONEY_SOURCE_NAME, getDashboardData } from './marketService';

describe('getDashboardData', () => {
  it('builds the dashboard from live market API responses instead of static fixtures', async () => {
    const requestedUrls: string[] = [];
    const fetcher = async (url: string) => {
      requestedUrls.push(url);

      const payload = url.includes('fs=m:90+t:2')
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
    expect(requestedUrls.every((url) => url.includes('push2.eastmoney.com'))).toBe(true);
  });

  it('keeps vendor names out of user-visible data labels', async () => {
    const fetcher = async (url: string) => {
      const payload = url.includes('fs=m:90+t:2')
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
