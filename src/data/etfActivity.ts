import { buildFinancialApiUrl } from './financialReportService';

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
export type ActivityBar = { time: string; amount: number };
export type ActivityHistory = { code: string; name: string; bars: ActivityBar[]; error?: string; cached?: boolean; updatedAt?: string | null };
const CACHE_KEY = 'alpha-desk-etf-activity-v1';

export function normalizeEtfHistories(input: unknown): ActivityHistory[] {
  if (!Array.isArray(input)) throw new Error('ETF 数据结构不完整');
  return ACTIVITY_ETFS.map((etf) => {
    const item = input.find((value) => value?.code === etf.code);
    if (!item || !Array.isArray(item.bars)) throw new Error('ETF 数据覆盖不完整');
    const bars = item.bars.filter((bar: ActivityBar) => bar && /^\d{4}-\d{2}-\d{2}$/.test(bar.time) && Number.isFinite(bar.amount) && bar.amount > 0);
    return { ...etf, bars, updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : null,
      cached: item.cached === true, error: typeof item.error === 'string' ? item.error : undefined };
  });
}

export async function fetchEtfActivity(force = false, fetcher = fetch): Promise<ActivityHistory[]> {
  const suffix = force ? `?refresh=${Date.now()}` : '';
  const response = await fetcher(buildFinancialApiUrl(`/api/etf-activity${suffix}`), { signal: AbortSignal.timeout(22000) });
  if (!response.ok) throw new Error('ETF 成交额服务暂不可用，已保留上次数据');
  const payload = await response.json();
  return normalizeEtfHistories(payload.histories);
}

export function mergeEtfHistories(previous: ActivityHistory[], next: ActivityHistory[]) {
  return next.map((item) => {
    const old = previous.find((value) => value.code === item.code);
    if (!old?.bars.length) return item;
    const oldIsNewer = (old.updatedAt ?? '') > (item.updatedAt ?? '');
    const bars = [...new Map((oldIsNewer ? [...item.bars, ...old.bars] : [...old.bars, ...item.bars]).map((bar) => [bar.time, bar])).values()].sort((a, b) => a.time.localeCompare(b.time)).slice(-100);
    return { ...item, bars, updatedAt: oldIsNewer ? old.updatedAt : item.updatedAt,
      cached: item.cached || !item.bars.length || oldIsNewer,
      error: item.error || (oldIsNewer ? '服务端快照较旧，保留本机数据' : undefined) };
  });
}

export function readEtfCache(): ActivityHistory[] {
  try {
    return normalizeEtfHistories(JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null')).map((item) => ({ ...item, cached: true }));
  } catch { return []; }
}

export function saveEtfCache(histories: ActivityHistory[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(histories)); } catch { /* Reading market data still works without browser storage. */ }
}

export function previousWeekFriday(date: string) {
  const day = new Date(`${date}T00:00:00Z`);
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() - weekday - 2);
  return day.toISOString().slice(0, 10);
}

// The existing daily K-line fallback uses zero when turnover is unavailable.
// Treat it as missing rather than reporting a fictitious zero or contraction.
function amount(bar?: ActivityBar) {
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
