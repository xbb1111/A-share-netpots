import { describe, expect, it } from 'vitest';
import { buildEtfActivity, previousWeekFriday, type ActivityHistory } from './etfActivity';
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
