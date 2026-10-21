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
];

export function parseEtfAmounts(payload, code) {
  if (payload.rc !== 0 || payload.data?.code !== code) throw new Error('成交额数据无效');
  const bars = (payload.data.klines ?? []).map((row) => {
    const fields = row.split(',');
    return { time: fields[0], amount: Number(fields[6]) };
  }).filter((bar) => /^\d{4}-\d{2}-\d{2}$/.test(bar.time) && Number.isFinite(bar.amount) && bar.amount > 0);
  const unique = [...new Map(bars.map((bar) => [bar.time, bar])).values()].sort((a, b) => a.time.localeCompare(b.time));
  if (unique.length < 20) throw new Error('有效成交额历史不足');
  return unique.slice(-100);
}

async function fetchAmounts(code, fetcher) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    // Both routes return actual turnover in yuan; price-only feeds cannot fill this table.
    return await Promise.any(['61.push2his.eastmoney.com', 'push2his.eastmoney.com'].map(async (host) => {
      const url = new URL(`https://${host}/api/qt/stock/kline/get`);
      Object.entries({ secid: `${code.startsWith('1') ? '0' : '1'}.${code}`, klt: '101', fqt: '0', lmt: '100', end: '20500101', fields1: 'f1,f2,f3,f4,f5,f6', fields2: 'f51,f52,f53,f54,f55,f56,f57,f58' }).forEach(([key, value]) => url.searchParams.set(key, value));
      const response = await fetcher(url.toString(), { signal: controller.signal });
      if (!response.ok) throw new Error(`行情源 HTTP ${response.status}`);
      return parseEtfAmounts(await response.json(), code);
    }));
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

export async function refreshEtfActivity(previous, { fetcher = fetch, now = new Date() } = {}) {
  const updatedAt = now.toISOString();
  const results = new Array(ACTIVITY_ETFS.length);
  let cursor = 0;
  async function worker() {
    while (cursor < ACTIVITY_ETFS.length) {
      const index = cursor++;
      const etf = ACTIVITY_ETFS[index];
      const old = previous.histories.find((item) => item.code === etf.code);
      try {
        const bars = await fetchAmounts(etf.code, fetcher);
        const merged = [...new Map([...(old?.bars ?? []), ...bars].map((bar) => [bar.time, bar])).values()].sort((a, b) => a.time.localeCompare(b.time)).slice(-100);
        const fresh = bars.at(-1).time >= (old?.bars.at(-1)?.time ?? '');
        results[index] = { ...etf, bars: merged, updatedAt: fresh ? updatedAt : old.updatedAt, cached: !fresh,
          ...(fresh ? {} : { error: '行情源日期落后，保留上次数据' }) };
      } catch {
        results[index] = { ...etf, bars: old?.bars ?? [], updatedAt: old?.updatedAt ?? null, cached: true,
          error: old?.bars.length ? '刷新未成功，保留上次数据' : '成交额暂不可用' };
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker));
  return { updatedAt, source: '东方财富日线成交额（元）', histories: results };
}

export function createEtfActivityService(seed, options = {}) {
  let snapshot = seed;
  let expiresAt = 0;
  let pending;
  return async function getSnapshot(force = false) {
    if (pending) return pending;
    if (!force && Date.now() < expiresAt) return snapshot;
    pending = refreshEtfActivity(snapshot, options).then((next) => {
      snapshot = next;
      expiresAt = Date.now() + 60000;
      return snapshot;
    }).finally(() => { pending = undefined; });
    return pending;
  };
}
