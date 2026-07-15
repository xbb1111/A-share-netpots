import { fetchKlineData } from './priceDiscipline';
import type { IndexBarPeriod, IndexComponent, PriceBar, PriceHistory } from './customIndex';
import { buildFinancialApiUrl } from './financialReportService';

type Fetcher = (input: string) => Promise<Pick<Response, 'ok' | 'json'>>;

export type CustomIndexData = {
  histories: PriceHistory;
  benchmarkHistory: PriceHistory;
  marketCaps: Record<string, number>;
  currentPrices: Record<string, number>;
  currentPE: Record<string, number>;
  diagnostics: Array<{ code: string; message: string }>;
  source: '东方财富';
  fetchedAt: string;
};

export type SecurityMetrics = { price: number | null; pe: number | null; marketCap: number | null; change: number | null };

export async function fetchSecurityMetrics(code: string, fetcher: Fetcher = fetch): Promise<SecurityMetrics> {
  const url = `${buildFinancialApiUrl('/api/security-metrics')}?code=${encodeURIComponent(code.trim())}`;
  const response = await fetcher(url);
  if (!response.ok) throw new Error('行情指标请求失败');
  const payload = (await response.json()) as { data?: { f43?: number; f162?: number; f116?: number; f170?: number } };
  const metrics = {
    price: typeof payload.data?.f43 === 'number' && payload.data.f43 > 0 ? payload.data.f43 / 100 : null,
    pe: typeof payload.data?.f162 === 'number' ? payload.data.f162 / 100 : null,
    marketCap: typeof payload.data?.f116 === 'number' && payload.data.f116 > 0 ? payload.data.f116 : null,
    change: typeof payload.data?.f170 === 'number' ? payload.data.f170 / 100 : null,
  };
  if (Object.values(metrics).every((value) => value === null)) throw new Error('行情指标为空');
  return metrics;
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
  const currentPrices: Record<string, number> = {};
  const currentPE: Record<string, number> = {};
  const diagnostics: Array<{ code: string; message: string }> = [];

  let nextComponentIndex = 0;
  const hydrateNextComponent = async () => {
    while (nextComponentIndex < components.length) {
      const component = components[nextComponentIndex]; nextComponentIndex += 1;
      const [klineResult, quoteResult] = await Promise.allSettled([
        fetchKlineData({ code: component.code, period, limit: 2000, fetcher }),
        fetchSecurityMetrics(component.code, fetcher),
      ]);
      if (klineResult.status === 'fulfilled') {
        const kline = klineResult.value;
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
      } else {
        histories[component.code] = [];
        diagnostics.push({ code: component.code, message: '历史行情请求失败' });
      }
      if (quoteResult.status === 'fulfilled') {
        const quote = quoteResult.value;
        if (quote.price !== null) currentPrices[component.code] = quote.price;
        if (quote.pe !== null) currentPE[component.code] = quote.pe;
        if (quote.marketCap !== null) marketCaps[component.code] = quote.marketCap;
        else diagnostics.push({ code: component.code, message: '市值数据不足' });
      } else diagnostics.push({ code: component.code, message: '市值数据不足' });
    }
  };
  await Promise.all(Array.from({ length: Math.min(4, components.length) }, () => hydrateNextComponent()));

  if (benchmarkCode) {
    try {
      const kline = await fetchKlineData({ code: benchmarkCode, period, limit: 2000, fetcher });
      benchmarkHistory[benchmarkCode] = kline.bars.map((bar) => ({ date: bar.time, close: bar.close }));
      if (benchmarkHistory[benchmarkCode].length === 0) diagnostics.push({ code: benchmarkCode, message: '基准指数历史行情不足' });
    } catch {
      diagnostics.push({ code: benchmarkCode, message: '基准指数请求失败' });
    }
  }

  return { histories, benchmarkHistory, marketCaps, currentPrices, currentPE, diagnostics, source: '东方财富', fetchedAt: new Date().toISOString() };
}
