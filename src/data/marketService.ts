import {
  Activity,
  AlertTriangle,
  BarChart3,
  Flame,
  Gauge,
  Radar,
} from 'lucide-react';
import type {
  AlertSignal,
  DashboardData,
  IndustrySignal,
  OverviewMetric,
  TrendDirection,
  WatchStock,
} from './types';
import { fetchIndustryBoards } from './industryService';
import { buildFinancialApiUrl } from './financialReportService';

export const EASTMONEY_SOURCE_NAME = '东方财富实时行情';
const DISPLAY_SOURCE_NAME = '实时行情';

const STOCK_LIST_URL =
  buildFinancialApiUrl('/api/market-stocks');

type Fetcher = (input: string) => Promise<Pick<Response, 'ok' | 'json'>>;

type GetDashboardDataOptions = {
  fetcher?: Fetcher;
  now?: Date;
  timeoutMs?: number;
};

const DEFAULT_MARKET_TIMEOUT_MS = 8_000;

function withTimeout<T>(request: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('行情接口请求超时')), timeoutMs);
    request.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

type EastmoneyResponse<T> = {
  data?: {
    diff?: T[];
  };
};

type EastmoneyStock = {
  f12: string;
  f14: string;
  f2: number;
  f3: number;
  f62: number;
  f100?: string;
};

type EastmoneySector = {
  f12: string;
  f14: string;
  f3: number;
  f62: number;
  f104?: number;
  f128?: string;
};

async function fetchEastmoneyList<T>(url: string, fetcher: Fetcher): Promise<T[]> {
  const response = await fetcher(url);

  if (!response.ok) {
    throw new Error(`行情接口请求失败: ${url}`);
  }

  const payload = (await response.json()) as EastmoneyResponse<T>;
  return payload.data?.diff ?? [];
}

function toHundredMillion(value: number) {
  return Number((value / 100_000_000).toFixed(2));
}

function clamp(value: number, min = 0, max = 100) {
  return Math.min(max, Math.max(min, value));
}

function toTrend(change: number): TrendDirection {
  if (change >= 1) {
    return 'up';
  }

  if (change <= -1) {
    return 'down';
  }

  return 'flat';
}

export function buildIndustries(sectors: EastmoneySector[]): IndustrySignal[] {
  const maxFlow = Math.max(...sectors.map((sector) => Math.abs(sector.f62)), 1);

  return sectors.map((sector) => {
    const flowScore = (Math.abs(sector.f62) / maxFlow) * 42;
    const changeScore = clamp((sector.f3 + 5) * 7, 0, 42);
    const activityScore = Math.min(sector.f104 ?? 0, 80) / 5;
    const heat = Math.round(clamp(flowScore + changeScore + activityScore));

    return {
      name: sector.f14,
      heat,
      capitalFlow: toHundredMillion(sector.f62),
      valuation: sector.f3 >= 3 ? '强势' : sector.f3 <= -1 ? '承压' : '均衡',
      momentum: `${sector.f3 >= 0 ? '上涨' : '下跌'} ${Math.abs(sector.f3).toFixed(2)}%，领涨 ${sector.f128 ?? '暂无'}`,
      trend: toTrend(sector.f3),
    };
  });
}

function buildWatchlist(stocks: EastmoneyStock[]): WatchStock[] {
  const candidates = stocks
    .filter((stock) => stock.f12 && stock.f14 && Number.isFinite(stock.f3) && Number.isFinite(stock.f2) && stock.f2 > 0 && Number.isFinite(stock.f62))
    .sort((a, b) => b.f62 - a.f62)
    .slice(0, 12);
  const maxFlow = Math.max(...candidates.map((stock) => Math.abs(stock.f62)), 1);

  return candidates.map((stock) => {
    const score = Math.round(clamp(45 + stock.f3 * 4 + (stock.f62 / maxFlow) * 35));
    const trend = toTrend(stock.f3);
    const flowText = stock.f62 >= 0 ? '主力净流入' : '主力净流出';

    return {
      code: stock.f12,
      name: stock.f14,
      industry: stock.f100 ?? '未分类',
      price: stock.f2,
      change: stock.f3,
      score,
      trend,
      tags: [flowText, trend === 'up' ? '强势' : trend === 'down' ? '走弱' : '震荡'],
      thesis: `${stock.f100 ?? '所属行业'}，${flowText} ${toHundredMillion(Math.abs(stock.f62))} 亿元，今日涨跌幅 ${stock.f3.toFixed(2)}%。`,
    };
  });
}

function buildAlerts(industries: IndustrySignal[], watchlist: WatchStock[], now: Date): AlertSignal[] {
  const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Shanghai' });
  const sectorAlerts = industries.slice(0, 3).map((industry): AlertSignal => ({
    title: industry.trend === 'down' ? '行业回撤' : '行业异动',
    target: industry.name,
    level: industry.heat >= 80 ? '高' : '中',
    type: industry.trend === 'down' ? 'risk' : 'rotation',
    message: `板块热度 ${industry.heat}，主力净流入 ${industry.capitalFlow} 亿元，${industry.momentum}。`,
    time,
  }));
  const stockAlerts = watchlist.slice(0, 3).map((stock): AlertSignal => ({
    title: Math.abs(stock.change) >= 5 ? '价格异动' : '资金异动',
    target: stock.name,
    level: Math.abs(stock.change) >= 5 || stock.score >= 85 ? '高' : '中',
    type: Math.abs(stock.change) >= 5 ? 'price' : 'volume',
    message: `${stock.industry}，现价 ${stock.price} 元，涨跌幅 ${stock.change.toFixed(2)}%，评分 ${stock.score}。`,
    time,
  }));

  return [...sectorAlerts, ...stockAlerts];
}

function buildOverview(industries: IndustrySignal[], watchlist: WatchStock[], alerts: AlertSignal[]): OverviewMetric[] {
  const risingCount = watchlist.filter((stock) => stock.change > 0).length;
  const fallingCount = watchlist.filter((stock) => stock.change < 0).length;
  const breadth = (risingCount - fallingCount) / Math.max(watchlist.length, 1);
  const averageChange =
    watchlist.reduce((total, stock) => total + stock.change, 0) / Math.max(watchlist.length, 1);
  const topIndustry = industries.reduce<IndustrySignal | undefined>((top, item) => !top || item.heat > top.heat ? item : top, undefined);
  const highPriorityAlerts = alerts.filter((alert) => alert.level === '高').length;

  return [
    {
      label: '股票池温度',
      value: watchlist.length ? String(Math.round(clamp(50 + averageChange * 6 + breadth * 15))) : '—',
      detail: watchlist.length ? `股票池平均涨跌幅 ${averageChange.toFixed(2)}%，上涨 ${risingCount}/${watchlist.length}。` : '暂无有效股票行情。',
      tone: averageChange === 0 ? 'neutral' : averageChange > 0 ? 'positive' : 'negative',
      icon: Gauge,
    },
    {
      label: '行业热度',
      value: topIndustry?.name ?? '暂无',
      detail: topIndustry ? `最强板块热度 ${topIndustry.heat}，净流入 ${topIndustry.capitalFlow} 亿元。` : '暂无行业行情。',
      tone: 'warning',
      icon: Flame,
    },
    {
      label: '高优先级预警',
      value: alerts.length ? String(highPriorityAlerts) : '—',
      detail: `当前预警队列共 ${alerts.length} 条。`,
      tone: highPriorityAlerts > 0 ? 'negative' : 'neutral',
      icon: AlertTriangle,
    },
    {
      label: '股票池表现',
      value: watchlist.length ? `${averageChange >= 0 ? '+' : ''}${averageChange.toFixed(2)}%` : '—',
      detail: '候选股等权平均涨跌幅。',
      tone: averageChange === 0 ? 'neutral' : averageChange > 0 ? 'positive' : 'negative',
      icon: Radar,
    },
  ];
}

function buildMarketCalendar(now: Date) {
  const dateLabel = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', weekday: 'short', timeZone: 'Asia/Shanghai' }).format(now);

  return [
    { date: dateLabel, event: 'A 股实时行情跟踪', impact: '盘中关注行业主力净流入和涨跌幅同步放大的板块。' },
    { date: 'T+1', event: '复盘强势板块', impact: '对比今日板块热度、龙头股表现和资金持续性。' },
    { date: '本周', event: '宏观与财报窗口', impact: '结合交易所公告、业绩预告和政策事件校验行情持续性。' },
  ];
}

export async function getDashboardData(options: GetDashboardDataOptions = {}): Promise<DashboardData> {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const timeoutMs = options.timeoutMs ?? DEFAULT_MARKET_TIMEOUT_MS;
  const [stocksResult, industriesResult] = await Promise.allSettled([
    withTimeout(fetchEastmoneyList<EastmoneyStock>(STOCK_LIST_URL, fetcher), timeoutMs),
    withTimeout(fetchIndustryBoards(fetcher), timeoutMs),
  ]);
  const stocks = stocksResult.status === 'fulfilled' ? stocksResult.value : [];
  const industries = industriesResult.status === 'fulfilled' ? industriesResult.value : [];
  const watchlist = buildWatchlist(stocks);
  const alerts = buildAlerts(industries, watchlist, now);
  const topThemes = industries.slice(0, 3);

  return {
    source: EASTMONEY_SOURCE_NAME,
    displaySource: industries.length && watchlist.length ? DISPLAY_SOURCE_NAME : industries.length || watchlist.length ? '部分行情可用' : '行情暂无数据',
    lastUpdated: now.toLocaleString('zh-CN', { hour12: false, timeZone: 'Asia/Shanghai' }),
    overview: buildOverview(industries, watchlist, alerts),
    industries,
    watchlist,
    alerts,
    marketCalendar: buildMarketCalendar(now),
    themes: topThemes.map((industry) => ({
      name: industry.name,
      strength: industry.heat,
      notes: `${industry.momentum}，主力净流入 ${industry.capitalFlow} 亿元。`,
    })),
    memos: [
      {
        title: '数据口径',
        body: '股票池和行业按主力净流入排序，指标来自实时行情接口。',
      },
      {
        title: '复核纪律',
        body: '预警为行情派生信号，不构成投资建议；交易前需要复核公告、成交额和市场环境。',
      },
    ],
  };
}

export function getTrendIconName(trend: TrendDirection): string {
  if (trend === 'up') {
    return '上行';
  }

  if (trend === 'down') {
    return '走弱';
  }

  return '震荡';
}

export const chartIcons = {
  activity: Activity,
  barChart: BarChart3,
};
