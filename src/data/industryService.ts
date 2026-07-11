import type { IndustryBoard, IndustryCompany, TrendDirection } from './types';

type Fetcher = (input: string) => Promise<Pick<Response, 'ok' | 'json'>>;

type EastmoneyResponse<T> = { data?: { diff?: T[] } };
type EastmoneyBoard = { f12: string; f14: string; f3?: number; f62?: number; f104?: number; f128?: string };

export const INDUSTRY_BOARD_LIST_URL =
  'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=100&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f62&fs=m:90+t:2&fields=f12,f14,f3,f62,f104,f128';

const companyCache = new Map<string, Promise<IndustryCompany[]>>();

function toNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toHundredMillion(value: number | null): number | null {
  return value === null ? null : Number((value / 100_000_000).toFixed(2));
}

function toTrend(change: number): TrendDirection {
  if (change >= 1) return 'up';
  if (change <= -1) return 'down';
  return 'flat';
}

function inferIndustryLevel(name: string): 1 | 2 | 3 {
  if (/Ⅲ$/.test(name)) return 3;
  if (/Ⅱ$/.test(name)) return 2;
  return 1;
}

async function fetchDiff<T>(url: string, fetcher: Fetcher): Promise<T[]> {
  const response = await fetcher(url);
  if (!response.ok) throw new Error('行业行情暂时不可用，请稍后重试。');
  const payload = await response.json() as EastmoneyResponse<T>;
  return payload.data?.diff ?? [];
}

export async function fetchIndustryBoards(fetcher: Fetcher = fetch): Promise<IndustryBoard[]> {
  const rows: EastmoneyBoard[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = INDUSTRY_BOARD_LIST_URL.replace('pn=1', `pn=${page}`);
    const pageRows = await fetchDiff<EastmoneyBoard>(url, fetcher);
    rows.push(...pageRows);
    if (pageRows.length < 100) break;
  }
  const maxFlow = Math.max(...rows.map((row) => Math.abs(toNullableNumber(row.f62) ?? 0)), 1);

  const boards = rows.map((row) => {
    const change = toNullableNumber(row.f3) ?? 0;
    const flow = toNullableNumber(row.f62) ?? 0;
    const flowScore = (Math.abs(flow) / maxFlow) * 42;
    const changeScore = Math.min(42, Math.max(0, (change + 5) * 7));
    const activityScore = Math.min(toNullableNumber(row.f104) ?? 0, 80) / 5;
    return {
      code: row.f12,
      name: row.f14,
      level: inferIndustryLevel(row.f14),
      change,
      heat: Math.round(Math.min(100, Math.max(0, flowScore + changeScore + activityScore))),
      capitalFlow: toHundredMillion(flow) ?? 0,
      valuation: change >= 3 ? '强势' : change <= -1 ? '承压' : '均衡',
      momentum: `${change >= 0 ? '上涨' : '下跌'} ${Math.abs(change).toFixed(2)}%，领涨 ${row.f128 ?? '暂无'}`,
      trend: toTrend(change),
      leaderName: row.f128,
    };
  });
  return boards.map((board) => {
    const parentName = board.level === 3 ? board.name.replace(/Ⅲ$/, 'Ⅱ') : board.level === 2 ? board.name.replace(/Ⅱ$/, '') : null;
    return parentName ? { ...board, parentCode: boards.find((candidate) => candidate.name === parentName)?.code } : board;
  });
}

export async function fetchIndustryCompanies(boardCode: string, fetcher: Fetcher = fetch): Promise<IndustryCompany[]> {
  const cached = companyCache.get(boardCode);
  if (cached) return cached;

  const url = `/api/industry-companies?boardCode=${encodeURIComponent(boardCode)}`;
  const request = fetcher(url)
    .then(async (response) => {
      if (!response.ok) throw new Error('公司行情暂时不可用，请稍后重试。');
      const payload = await response.json() as { companies?: IndustryCompany[] };
      return payload.companies ?? [];
    })
    .catch((error) => {
      companyCache.delete(boardCode);
      throw error;
    });
  companyCache.set(boardCode, request);
  return request;
}

export function clearIndustryCompanyCache() {
  companyCache.clear();
}
