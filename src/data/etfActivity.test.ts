import { describe, expect, it } from 'vitest';
import { ACTIVITY_ETFS, buildEtfActivity, fetchEtfActivity, mergeEtfHistories, previousWeekFriday, type ActivityHistory } from './etfActivity';
import type { PriceBar } from './priceDiscipline';

const bar = (time: string, amount: number): PriceBar => ({ time, amount, open: 1, close: 1, high: 1, low: 1, volume: 1, amplitude: 0 });
function history(code = '510300'): ActivityHistory {
  const bars: PriceBar[] = [];
  for (let day = 1; day <= 21; day++) {
    const date = `2026-09-${String(day).padStart(2, '0')}`;
    if (![0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay())) bars.push(bar(date, 1e8));
  }
  bars.push(bar('2026-09-22', 2e8));
  return { code, name: code, bars };
}
describe('ETF activity comparisons', () => {
  it('loads one aggregate request instead of ten price-only K-line requests', async () => {
    const urls: string[] = [];
    const items = await fetchEtfActivity(true, (async (url: string) => {
      urls.push(url);
      return { ok: true, json: async () => ({ histories: ACTIVITY_ETFS.map((etf) => ({ ...etf, bars: [{ time: '2026-10-21', amount: 1e8 }] })) }) };
    }) as typeof fetch);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain('/api/etf-activity?refresh=');
    expect(items).toHaveLength(10);
  });
  it('preserves the last good amounts when a later response is empty or older', () => {
    const previous = { ...history(), updatedAt: '2026-09-22T08:00:00Z' };
    const [merged] = mergeEtfHistories([previous], [{ code: previous.code, name: previous.name, bars: [], cached: true, error: '刷新失败' }]);
    expect(merged.bars).toEqual(previous.bars);
    expect(merged.cached).toBe(true);
    expect(merged.updatedAt).toBe(previous.updatedAt);
    const [older] = mergeEtfHistories([previous], [{ ...previous, updatedAt: '2026-09-22T07:00:00Z', bars: [bar('2026-09-22', 1e8)] }]);
    expect(older.bars.at(-1)?.amount).toBe(2e8);
  });
  it('uses the prior natural week Friday across weekends and year boundaries', () => {
    expect(previousWeekFriday('2026-09-21')).toBe('2026-09-18');
    expect(previousWeekFriday('2026-09-25')).toBe('2026-09-18');
    expect(previousWeekFriday('2026-09-27')).toBe('2026-09-18');
    expect(previousWeekFriday('2026-01-01')).toBe('2025-12-26');
  });
  it('excludes the selected day from the 15-day average and sorts by turnover', () => {
    const larger = history('159915');
    larger.bars.at(-1)!.amount = 3e8;
    const data = buildEtfActivity([history(), larger]);
    expect(data.rows[0].code).toBe('159915');
    expect(data.rows[0].averageRatio).toBe(3);
    expect(data.csi300.amount).toBe(2);
    expect(data.total.amount).toBe(5);
    expect(data.total.fridayRatio).toBe(2.5);
    expect(buildEtfActivity([history()], '2026-09-21').rows[0].averageRatio).toBeNull();
  });
  it('keeps missing fallback turnover and incomplete totals unknown', () => {
    const missing = history('159919');
    missing.bars.at(-1)!.amount = 0;
    const data = buildEtfActivity([history(), missing]);
    expect(data.rows[1].amount).toBeNull();
    expect(data.total.amount).toBeNull();
    expect(data.total.fridayRatio).toBeNull();
    expect(data.total.coverage).toBe(1);
  });
  it('does not substitute stale dates or another day for a missing Friday', () => {
    const stale = history('159919');
    stale.bars.pop();
    const current = history();
    current.bars = current.bars.filter((point) => point.time !== '2026-09-18');
    const data = buildEtfActivity([current, stale]);
    expect(data.rows[0].fridayRatio).toBeNull();
    expect(data.rows[0].averageRatio).toBeNull();
    expect(data.rows[1].amount).toBeNull();
  });
});
