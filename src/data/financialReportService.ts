import type { FilingAnalysisResult, FilingSummary, FilingType, Security } from './financialReports';

type JsonResponse = Pick<Response, 'ok' | 'json'>;
type ReportFetcher = (input: string, init?: RequestInit) => Promise<JsonResponse>;

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
    `/api/securities/search?q=${encodeURIComponent(trimmed)}`,
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

  const payload = await getJson<{ filings?: FilingSummary[] }>(`/api/filings?${params.toString()}`, fetcher);
  return payload.filings ?? [];
}

export async function fetchFilingAnalysis(
  request: FilingAnalysisRequest,
  fetcher: ReportFetcher = fetch,
): Promise<FilingAnalysisResult> {
  const payload = await getJson<{ analysis?: FilingAnalysisResult }>('/api/filings/analyze', fetcher, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!payload.analysis) {
    throw new Error('财报分析服务暂不可用：分析结果为空');
  }

  return payload.analysis;
}

async function getJson<T>(url: string, fetcher: ReportFetcher, init?: RequestInit): Promise<T> {
  const response = await fetcher(url, init);
  const payload = (await response.json().catch(() => ({}))) as { message?: string };

  if (!response.ok) {
    throw new Error(`财报分析服务暂不可用：${payload.message ?? '请求失败'}`);
  }

  return payload as T;
}
