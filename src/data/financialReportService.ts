import type { FilingAnalysisResult, FilingSummary, FilingType, Security } from './financialReports';

type JsonResponse = Pick<Response, 'ok' | 'json'>;
type ReportFetcher = (input: string, init?: RequestInit) => Promise<JsonResponse>;
const FINANCIAL_API_BASE = import.meta.env.VITE_FINANCIAL_REPORT_API_BASE as string | undefined;

export type FilingQuery = {
  code: string;
  type?: FilingType | 'all';
  from?: string;
  to?: string;
};

export type FilingAnalysisRequest = {
  code: string;
  filingId: string;
};

export async function searchReportSecurities(
  query: string,
  fetcher: ReportFetcher = fetch,
): Promise<Security[]> {
  const trimmed = query.trim();

  if (!trimmed) {
    return [];
  }

  const payload = await getJson<{ securities?: Security[] }>(
    buildFinancialApiUrl(`/api/securities/search?q=${encodeURIComponent(trimmed)}`),
    fetcher,
  );

  return payload.securities ?? [];
}

export async function fetchFinancialFilings(
  query: FilingQuery,
  fetcher: ReportFetcher = fetch,
): Promise<FilingSummary[]> {
  const params = new URLSearchParams();
  params.set('code', query.code.trim());

  if (query.type && query.type !== 'all') {
    params.set('type', query.type);
  }

  if (query.from) {
    params.set('from', query.from);
  }

  if (query.to) {
    params.set('to', query.to);
  }

  const payload = await getJson<{ filings?: FilingSummary[] }>(buildFinancialApiUrl(`/api/filings?${params.toString()}`), fetcher);
  return payload.filings ?? [];
}

export async function fetchFilingAnalysis(
  request: FilingAnalysisRequest,
  fetcher: ReportFetcher = fetch,
): Promise<FilingAnalysisResult> {
  const payload = await getJson<{ analysis?: FilingAnalysisResult }>(buildFinancialApiUrl('/api/filings/analyze'), fetcher, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!payload.analysis) {
    throw new Error('财报分析服务暂不可用：分析结果为空');
  }

  return payload.analysis;
}

export function buildFinancialApiUrl(path: string, apiBase = FINANCIAL_API_BASE): string {
  if (!apiBase?.trim()) {
    return path;
  }

  return `${apiBase.replace(/\/+$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

async function getJson<T>(url: string, fetcher: ReportFetcher, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, init).catch((error) => {
    throw new Error(`财报分析服务暂不可用：${getStaticHostingHint()}${error instanceof Error ? error.message : '请求失败'}`);
  });
  const payload = (await response.json().catch(() => ({}))) as { message?: string };

  if (!response.ok) {
    throw new Error(`财报分析服务暂不可用：${payload.message ?? getStaticHostingHint()}`);
  }

  return payload as T;
}

function getStaticHostingHint() {
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('github.io') && !FINANCIAL_API_BASE) {
    return '线上静态页面未连接财报分析 API。GitHub Pages 不能运行 Node 后端，请部署 API 后配置 VITE_FINANCIAL_REPORT_API_BASE。';
  }

  return '线上静态页面未连接财报分析 API；本地请确认 npm run api 已启动。';
}
