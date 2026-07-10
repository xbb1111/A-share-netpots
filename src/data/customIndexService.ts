import { fetchKlineData } from './priceDiscipline';
import type { IndexBarPeriod, IndexComponent, PriceBar, PriceHistory } from './customIndex';

type Fetcher = (input: string) => Promise<Pick<Response, 'ok' | 'json'>>;

export type CustomIndexData = {
  histories: PriceHistory;
  benchmarkHistory: PriceHistory;
  marketCaps: Record<string, number>;
  diagnostics: Array<{ code: string; message: string }>;
  source: '东方财富';
  fetchedAt: string;
};

function getSecid(code: string) {
  return `${/^(6|68)/.test(code) ? '1' : '0'}.${code}`;
}

async function fetchMarketCap(code: string, fetcher: Fetcher) {
  const url = new URL('https://push2.eastmoney.com/api/qt/stock/get');
  url.searchParams.set('secid', getSecid(code));
  url.searchParams.set('fields', 'f116');
  const response = await fetcher(url.toString());
  if (!response.ok) return null;
  const payload = (await response.json()) as { data?: { f116?: number } };
  return typeof payload.data?.f116 === 'number' && payload.data.f116 > 0 ? payload.data.f116 : null;
}

export async function fetchCustomIndexData(
  components: IndexComponent[],
  fetcher: Fetcher = fetch,
  benchmarkCode?: string,
  period: IndexBarPeriod = 'daily',
): Promise<CustomIndexData> {
  const histories: PriceHistory = {};
  const benchmarkHistory: PriceHistory = {};
  const marketCaps: Record<string, number> = {};
  const diagnostics: Array<{ code: string; message: string }> = [];

  await Promise.all(
    components.map(async (component) => {
      try {
        const [kline, marketCap] = await Promise.all([
          fetchKlineData({ code: component.code, period, limit: 2000, fetcher }),
          fetchMarketCap(component.code, fetcher),
        ]);
        histories[component.code] = kline.bars.map((bar) => ({
          date: bar.time,
          open: bar.open,
          high: bar.high,
          low: bar.low,
          close: bar.close,
        })) as PriceBar[];
        if (histories[component.code].length === 0) {
          diagnostics.push({ code: component.code, message: '历史行情不足' });
        }
        if (marketCap !== null) marketCaps[component.code] = marketCap;
        else diagnostics.push({ code: component.code, message: '市值数据不足' });
      } catch {
        histories[component.code] = [];
        diagnostics.push({ code: component.code, message: '历史行情请求失败' });
      }
    }),
  );

  if (benchmarkCode) {
    try {
      const kline = await fetchKlineData({ code: benchmarkCode, period, limit: 2000, fetcher });
      benchmarkHistory[benchmarkCode] = kline.bars.map((bar) => ({ date: bar.time, close: bar.close }));
      if (benchmarkHistory[benchmarkCode].length === 0) diagnostics.push({ code: benchmarkCode, message: '基准指数历史行情不足' });
    } catch {
      diagnostics.push({ code: benchmarkCode, message: '基准指数请求失败' });
    }
  }

  return { histories, benchmarkHistory, marketCaps, diagnostics, source: '东方财富', fetchedAt: new Date().toISOString() };
}
