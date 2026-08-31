import { buildFinancialApiUrl } from './financialReportService';

export type SentimentPoint = {
  date: string;
  value: number;
  percentile252: number | null;
  rising0To5Share?: number | null;
  rising5To10Share?: number | null;
  risingAbove10Share?: number | null;
  top3Industries?: Array<{ name: string; amountYi: number; share: number }>;
  totalAmountYi?: number | null;
  amountEstimated?: boolean;
};

export type SentimentMetric = {
  id: 'turnover' | 'top3IndustryShare' | 'risingShare' | 'aboveMa20Share' | 'marginBuyShare' | 'erp';
  name: string;
  unit: string;
  direction: 'higher-hot' | 'lower-hot';
  source: string;
  formula: string;
  interpretation: string;
  value: number | null;
  percentile252: number | null;
  zone: '极度恐慌' | '偏冷' | '中性' | '偏热' | '极度贪婪' | '数据不足';
  series: SentimentPoint[];
};

export type SentimentTheme = { name: string; amountYi: number };

export type SentimentSnapshot = {
  commonAsOf: string | null;
  marketAsOf: string | null;
  dataLagTradingDays: number;
  updatedAt: string;
  stale: boolean;
  industryClassification: string | null;
  industryMappingCoverage: number | null;
  themeAsOf: string | null;
  topThemes: SentimentTheme[];
  methodology: string;
  metrics: SentimentMetric[];
};

type Fetcher = (input: string) => Promise<Pick<Response, 'ok' | 'json'>>;

export async function fetchSentimentSnapshot(refresh = false, fetcher: Fetcher = fetch): Promise<SentimentSnapshot> {
  const url = buildFinancialApiUrl(`/api/market-sentiment${refresh ? '?refresh=1' : ''}`);
  const response = await fetcher(url);
  const payload = await response.json().catch(() => ({})) as Partial<SentimentSnapshot> & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? '情绪指标数据暂时不可用');
  if (!payload.commonAsOf || !Array.isArray(payload.metrics) || payload.metrics.length !== 6) {
    throw new Error('情绪指标数据不完整');
  }
  return payload as SentimentSnapshot;
}

export function clampSentimentRange(start: number, end: number, length: number, changed: 'start' | 'end') {
  const last = Math.max(0, length - 1);
  const minimumSpan = Math.min(20, length);
  let nextStart = Math.max(0, Math.min(Math.round(start), last));
  let nextEnd = Math.max(0, Math.min(Math.round(end), last));
  if (nextEnd - nextStart + 1 < minimumSpan) {
    if (changed === 'start') nextStart = Math.max(0, nextEnd - minimumSpan + 1);
    else nextEnd = Math.min(last, nextStart + minimumSpan - 1);
  }
  return { start: nextStart, end: nextEnd };
}
