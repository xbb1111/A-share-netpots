import { buildFinancialApiUrl } from './financialReportService';

export type CapitalQualityFlag = 'missing-nav' | 'missing-shares' | 'split-suspect' | 'partial-coverage' | string;
export type CapitalFlowPoint = { date: string; netFlowYi: number | null; amountYi: number | null; coverage: number; expected: number; qualityFlags: CapitalQualityFlag[] };
export type CapitalEtfPoint = { date: string; nav: number | null; shares: number | null; shareChange: number | null; aumYi: number | null; netFlowYi: number | null; amountYi: number | null; qualityFlags: CapitalQualityFlag[] };
export type CapitalEtf = { code: string; name: string; indexId: string; indexName: string; exchange: 'SSE' | 'SZSE'; asOf: string | null; nav: number | null; shares: number | null; shareChange: number | null; netFlowYi: number | null; amountYi: number | null; source: string; methodology: string; qualityFlags: CapitalQualityFlag[]; series: CapitalEtfPoint[] };
export type CapitalIndexGroup = { id: string; name: string; series: CapitalFlowPoint[] };
export type CapitalMemberPoint = { date: string; long: number; short: number; net: number; netChange: number; qualityFlags: CapitalQualityFlag[] };
export type CapitalMember = { name: string; long: number; short: number; longChange: number; shortChange: number; net: number; netChange: number; hasLong: boolean; hasShort: boolean; qualityFlags: CapitalQualityFlag[]; history: CapitalMemberPoint[] };
export type CapitalTier = { long: number; short: number; net: number; longChange: number; shortChange: number; netChange: number; longShortRatio: number | null };
export type CapitalProductPoint = CapitalTier & { date: string; contracts: string[] };
export type CapitalProduct = { id: 'IF' | 'IH' | 'IC' | 'IM'; name: string; asOf: string | null; contracts: string[]; latest: { top5: CapitalTier; top10: CapitalTier; top20: CapitalTier } | null; summarySeries: CapitalProductPoint[]; members: CapitalMember[]; source: string; methodology: string; qualityFlags: CapitalQualityFlag[] };

export type LargeCapitalSnapshot = {
  version: number;
  asOf: string | null;
  updatedAt: string;
  stale: boolean;
  status: string;
  methodology: string;
  nationalTeam: {
    asOf: string | null;
    label: string;
    disclaimer: string;
    source: string;
    summaries: { day1: number | null; day5: number | null; day20: number | null };
    indexGroups: CapitalIndexGroup[];
    etfs: CapitalEtf[];
    events: Array<{ date: string; title: string; summary: string; source: string; url: string }>;
    qualityFlags: CapitalQualityFlag[];
  };
  institutions: { asOf: string | null; label: string; disclaimer: string; source: string; products: CapitalProduct[]; qualityFlags: CapitalQualityFlag[] };
};

type Fetcher = (input: string) => Promise<Pick<Response, 'ok' | 'json'>>;

export async function fetchLargeCapitalSnapshot(fetcher: Fetcher = fetch): Promise<LargeCapitalSnapshot> {
  const response = await fetcher(buildFinancialApiUrl('/api/large-capital-flows'));
  const payload = await response.json().catch(() => ({})) as Partial<LargeCapitalSnapshot> & { message?: string };
  if (!response.ok) throw new Error(payload.message ?? '大资金动向数据暂时不可用');
  if (!('nationalTeam' in payload) || !('institutions' in payload)) throw new Error('大资金动向数据结构不完整');
  return payload as LargeCapitalSnapshot;
}

export function capitalWindow<T>(series: readonly T[], count: number) { return series.slice(-count); }
export function sortCapitalMembers(members: readonly CapitalMember[], mode: 'long' | 'short' | 'netLong' | 'netShort') {
  const copy = [...members];
  if (mode === 'long') return copy.sort((a, b) => b.long - a.long);
  if (mode === 'short') return copy.sort((a, b) => b.short - a.short);
  if (mode === 'netLong') return copy.sort((a, b) => b.net - a.net);
  return copy.sort((a, b) => a.net - b.net);
}
