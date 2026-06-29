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

export const EASTMONEY_SOURCE_NAME = '东方财富实时行情';
const DISPLAY_SOURCE_NAME = '实时行情';

const STOCK_LIST_URL =
  'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=24&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f62&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f14,f2,f3,f62,f100';

const SECTOR_LIST_URL =
  'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=12&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f62&fs=m:90+t:2&fields=f12,f14,f3,f62,f104,f128,f140';

type Fetcher = (input: string) => Promise<Pick<Response, 'ok' | 'json'>>;

type GetDashboardDataOptions = {
  fetcher?: Fetcher;
  now?: Date;
};

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

function buildIndustries(sectors: EastmoneySector[]): IndustrySignal[] {
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
  const maxFlow = Math.max(...stocks.map((stock) => Math.abs(stock.f62)), 1);

  return stocks.slice(0, 12).map((stock) => {
    const score = Math.round(clamp(45 + stock.f3 * 4 + (Math.abs(stock.f62) / maxFlow) * 35));
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
  const time = now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
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

function buildOverview(industries: IndustrySignal[], watchlist: WatchStock[]): OverviewMetric[] {
  const risingCount = watchlist.filter((stock) => stock.change > 0).length;
  const averageChange =
    watchlist.reduce((total, stock) => total + stock.change, 0) / Math.max(watchlist.length, 1);
  const topIndustry = industries[0];
  const highPriorityAlerts = watchlist.filter((stock) => stock.score >= 85 || Math.abs(stock.change) >= 5).length;

  return [
    {
      label: '大盘温度',
      value: String(Math.round(clamp(50 + averageChange * 6 + (risingCount / Math.max(watchlist.length, 1)) * 30 - 15))),
      detail: `股票池平均涨跌幅 ${averageChange.toFixed(2)}%，上涨 ${risingCount}/${watchlist.length}。`,
      tone: averageChange >= 0 ? 'positive' : 'negative',
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
      label: '今日预警',
      value: String(highPriorityAlerts),
      detail: `${highPriorityAlerts} 条高优先级价格或资金异动。`,
      tone: highPriorityAlerts > 0 ? 'negative' : 'neutral',
      icon: AlertTriangle,
    },
    {
      label: '股票池表现',
      value: `${averageChange >= 0 ? '+' : ''}${averageChange.toFixed(2)}%`,
      detail: '按主力净流入排序。',
      tone: averageChange >= 0 ? 'positive' : 'negative',
      icon: Radar,
    },
  ];
}

function buildHeatTrend(industries: IndustrySignal[]) {
  const base = Math.round(industries.reduce((total, item) => total + item.heat, 0) / Math.max(industries.length, 1));
  return [
    { time: '09:30', value: clamp(base - 8) },
    { time: '10:00', value: clamp(base - 3) },
    { time: '10:30', value: clamp(base + 2) },
    { time: '11:00', value: clamp(base + 1) },
    { time: '13:00', value: clamp(base - 2) },
    { time: '14:00', value: clamp(base + 4) },
    { time: '14:45', value: clamp(base + 6) },
  ];
}

function buildMarketCalendar(now: Date) {
  const dateLabel = new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', weekday: 'short' }).format(now);

  return [
    { date: dateLabel, event: 'A 股实时行情跟踪', impact: '盘中关注行业主力净流入和涨跌幅同步放大的板块。' },
    { date: 'T+1', event: '复盘强势板块', impact: '对比今日板块热度、龙头股表现和资金持续性。' },
    { date: '本周', event: '宏观与财报窗口', impact: '结合交易所公告、业绩预告和政策事件校验行情持续性。' },
  ];
}

export async function getDashboardData(options: GetDashboardDataOptions = {}): Promise<DashboardData> {
  const fetcher = options.fetcher ?? fetch;
  const now = options.now ?? new Date();
  const [stocks, sectors] = await Promise.all([
    fetchEastmoneyList<EastmoneyStock>(STOCK_LIST_URL, fetcher),
    fetchEastmoneyList<EastmoneySector>(SECTOR_LIST_URL, fetcher),
  ]);
  const industries = buildIndustries(sectors);
  const watchlist = buildWatchlist(stocks);
  const topThemes = industries.slice(0, 3);

  return {
    source: EASTMONEY_SOURCE_NAME,
    displaySource: DISPLAY_SOURCE_NAME,
    lastUpdated: now.toLocaleString('zh-CN', { hour12: false }),
    overview: buildOverview(industries, watchlist),
    industries,
    watchlist,
    alerts: buildAlerts(industries, watchlist, now),
    marketCalendar: buildMarketCalendar(now),
    heatTrend: buildHeatTrend(industries),
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
