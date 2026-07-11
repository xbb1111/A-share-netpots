import type { LucideIcon } from 'lucide-react';

export type TrendDirection = 'up' | 'down' | 'flat';

export type OverviewMetric = {
  label: string;
  value: string;
  detail: string;
  tone: 'positive' | 'negative' | 'neutral' | 'warning';
  icon: LucideIcon;
};

export type IndustrySignal = {
  name: string;
  heat: number;
  capitalFlow: number;
  valuation: string;
  momentum: string;
  trend: TrendDirection;
};

export type IndustryStageId = 'upstream' | 'midstream' | 'downstream';

export type IndustryChainNode = {
  id: string;
  name: string;
  description: string;
  matchKeywords: string[];
  boardCodes?: string[];
};

export type IndustryChainStage = {
  id: IndustryStageId;
  name: string;
  nodes: IndustryChainNode[];
};

export type IndustryChain = {
  id: string;
  name: string;
  summary: string;
  stages: IndustryChainStage[];
};

export type IndustryBoard = IndustrySignal & {
  code: string;
  level: 1 | 2 | 3;
  change: number;
  parentCode?: string;
  leaderName?: string;
};

export type IndustryCompany = {
  code: string;
  name: string;
  price: number | null;
  change: number | null;
  capitalFlow: number | null;
  marketCap: number | null;
  industry: string;
};

export type WatchStock = {
  code: string;
  name: string;
  industry: string;
  price: number;
  change: number;
  score: number;
  trend: TrendDirection;
  tags: string[];
  thesis: string;
};

export type AlertSignal = {
  title: string;
  target: string;
  level: '高' | '中' | '低';
  type: 'price' | 'volume' | 'rotation' | 'risk';
  message: string;
  time: string;
};

export type CalendarItem = {
  date: string;
  event: string;
  impact: string;
};

export type ThemeFocus = {
  name: string;
  strength: number;
  notes: string;
};

export type StrategyMemo = {
  title: string;
  body: string;
};

export type HeatTrendPoint = {
  time: string;
  value: number;
};

export type DashboardData = {
  source: string;
  displaySource: string;
  lastUpdated: string;
  overview: OverviewMetric[];
  industries: IndustryBoard[];
  watchlist: WatchStock[];
  alerts: AlertSignal[];
  marketCalendar: CalendarItem[];
  heatTrend: HeatTrendPoint[];
  themes: ThemeFocus[];
  memos: StrategyMemo[];
};
