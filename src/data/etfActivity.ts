import { fetchKlineData, type PriceBar } from './priceDiscipline';

export const ACTIVITY_ETFS = [
  { code: '159915', name: '创业板ETF易方达' },
  { code: '588000', name: '科创50ETF华夏' },
  { code: '510300', name: '沪深300ETF华泰柏瑞' },
  { code: '512100', name: '中证1000ETF南方' },
  { code: '510500', name: '中证500ETF南方' },
  { code: '588080', name: '科创50ETF易方达' },
  { code: '510050', name: '上证50ETF华夏' },
  { code: '159919', name: '沪深300ETF嘉实' },
  { code: '510310', name: '沪深300ETF易方达' },
  { code: '510330', name: '沪深300ETF华夏' },
] as const;
const CSI300 = new Set(['510300', '159919', '510310', '510330']);
export type ActivityHistory = { code: string; name: string; bars: PriceBar[]; error?: string };

export async function fetchEtfActivity(): Promise<ActivityHistory[]> {
  const results = await Promise.allSettled(ACTIVITY_ETFS.map(async (etf) => {
    const data = await fetchKlineData({ code: etf.code, period: 'daily', limit: 100,
      fetcher: (url) => fetch(url, { signal: AbortSignal.timeout(25000) }),
    });
    if (!data.bars.length) throw new Error('未返回日线数据');
    return { ...etf, bars: data.bars };
  }));
  return results.map((result, index) => result.status === 'fulfilled' ? result.value : {
    ...ACTIVITY_ETFS[index], bars: [], error: '行情暂不可用，请重试',
  });
}

export function previousWeekFriday(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() - weekday - 2);
  return day.toISOString().slice(0, 10);
}

// The existing daily K-line fallback uses zero when turnover is unavailable.
// Treat it as missing rather than reporting a fictitious zero or contraction.
function amount(bar?: PriceBar) {
  return bar && Number.isFinite(bar.amount) && bar.amount > 0 ? bar.amount / 1e8 : null;
}
function ratio(value: number | null, base: number | null) {
  return value !== null && base !== null && base > 0 ? value / base : null;
}

export function buildEtfActivity(histories: ActivityHistory[], selectedDate?: string) {
  const dates = [...new Set(histories.flatMap((item) => item.bars.map((bar) => bar.time.slice(0, 10))))].sort().reverse();
  const date = selectedDate || dates[0] || null;
  const friday = date ? previousWeekFriday(date) : null;
  const rows = histories.map((item) => {
    const bars = [...item.bars].sort((a, b) => a.time.localeCompare(b.time));
    const current = bars.find((bar) => bar.time.slice(0, 10) === date);
    const history = bars.filter((bar) => date && bar.time.slice(0, 10) < date).slice(-15);
    const amounts = history.map(amount);
    const average = amounts.length === 15 && amounts.every((value) => value !== null)
      ? amounts.reduce<number>((sum, value) => sum + value!, 0) / 15 : null;
    const currentAmount = amount(current);
    const fridayAmount = amount(bars.find((bar) => bar.time.slice(0, 10) === friday));
    return { ...item, amount: currentAmount, average, fridayAmount,
      averageRatio: ratio(currentAmount, average), fridayRatio: ratio(currentAmount, fridayAmount),
    };
  }).sort((a, b) => (b.amount ?? -1) - (a.amount ?? -1));
  function summarize(items: typeof rows) {
    const sum = (key: 'amount' | 'average' | 'fridayAmount') => items.length && items.every((row) => row[key] !== null)
      ? items.reduce((total, row) => total + row[key]!, 0) : null;
    const total = sum('amount');
    const fridayTotal = sum('fridayAmount');
    return { amount: total, averageRatio: ratio(total, sum('average')), fridayAmount: fridayTotal,
      fridayRatio: ratio(total, fridayTotal), coverage: items.filter((row) => row.amount !== null).length, expected: items.length };
  }
  return { dates, date, friday, rows, total: summarize(rows), csi300: summarize(rows.filter((row) => CSI300.has(row.code))) };
}
