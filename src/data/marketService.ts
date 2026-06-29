import {
  Activity,
  AlertTriangle,
  BarChart3,
  Flame,
  Gauge,
  Radar,
} from 'lucide-react';
import type { DashboardData } from './types';

const dashboardData: DashboardData = {
  overview: [
    {
      label: '大盘温度',
      value: '63',
      detail: '风险偏好回暖，量能温和放大',
      tone: 'positive',
      icon: Gauge,
    },
    {
      label: '行业热度',
      value: '新能源 / 算力',
      detail: '强势行业集中度提升',
      tone: 'warning',
      icon: Flame,
    },
    {
      label: '今日预警',
      value: '12',
      detail: '4 条高优先级需要复核',
      tone: 'negative',
      icon: AlertTriangle,
    },
    {
      label: '自选池表现',
      value: '+1.86%',
      detail: '跑赢沪深 300 0.92pct',
      tone: 'positive',
      icon: Radar,
    },
  ],
  industries: [
    { name: '算力基础设施', heat: 91, capitalFlow: 18.4, valuation: '偏高', momentum: '连续 5 日上行', trend: 'up' },
    { name: '电力设备', heat: 86, capitalFlow: 12.9, valuation: '合理', momentum: '修复中', trend: 'up' },
    { name: '半导体', heat: 78, capitalFlow: 8.6, valuation: '偏高', momentum: '高位震荡', trend: 'flat' },
    { name: '创新药', heat: 73, capitalFlow: 6.3, valuation: '合理', momentum: '低位抬升', trend: 'up' },
    { name: '有色金属', heat: 69, capitalFlow: 5.1, valuation: '中性', momentum: '分歧加大', trend: 'flat' },
    { name: '消费电子', heat: 62, capitalFlow: 2.7, valuation: '合理', momentum: '事件驱动', trend: 'up' },
    { name: '白酒', heat: 43, capitalFlow: -3.8, valuation: '偏低', momentum: '弱修复', trend: 'down' },
    { name: '地产链', heat: 31, capitalFlow: -9.5, valuation: '低位', momentum: '趋势偏弱', trend: 'down' },
  ],
  watchlist: [
    {
      code: '300750',
      name: '宁德时代',
      industry: '电力设备',
      price: 218.6,
      change: 2.41,
      score: 89,
      trend: 'up',
      tags: ['龙头', '景气修复', '机构重仓'],
      thesis: '海外储能订单改善，毛利率修复弹性仍在。',
    },
    {
      code: '601138',
      name: '工业富联',
      industry: '算力基础设施',
      price: 29.48,
      change: 3.18,
      score: 87,
      trend: 'up',
      tags: ['AI服务器', '放量突破'],
      thesis: 'AI 服务器链条景气维持，量价配合良好。',
    },
    {
      code: '688981',
      name: '中芯国际',
      industry: '半导体',
      price: 62.12,
      change: 0.74,
      score: 81,
      trend: 'flat',
      tags: ['国产替代', '观察'],
      thesis: '板块估值偏高，等待业绩兑现或回踩确认。',
    },
    {
      code: '600276',
      name: '恒瑞医药',
      industry: '创新药',
      price: 51.36,
      change: 1.26,
      score: 78,
      trend: 'up',
      tags: ['创新药', '低波动'],
      thesis: '研发管线持续兑现，适合中线跟踪。',
    },
    {
      code: '002475',
      name: '立讯精密',
      industry: '消费电子',
      price: 37.92,
      change: -0.36,
      score: 74,
      trend: 'flat',
      tags: ['端侧 AI', '回踩'],
      thesis: '新终端周期预期仍在，短线等待资金回流。',
    },
    {
      code: '600519',
      name: '贵州茅台',
      industry: '白酒',
      price: 1518.8,
      change: -1.08,
      score: 66,
      trend: 'down',
      tags: ['防御', '估值修复'],
      thesis: '基本面稳定，但行业 beta 较弱。',
    },
  ],
  alerts: [
    {
      title: '行业轮动增强',
      target: '算力基础设施',
      level: '高',
      type: 'rotation',
      message: '热度与资金流同步上行，关注龙头分歧后的二次确认。',
      time: '09:58',
    },
    {
      title: '放量突破',
      target: '工业富联',
      level: '高',
      type: 'volume',
      message: '成交额显著放大，价格突破 20 日平台上沿。',
      time: '10:24',
    },
    {
      title: '回撤观察',
      target: '贵州茅台',
      level: '中',
      type: 'risk',
      message: '跌破短期均线，防御资产资金承接偏弱。',
      time: '11:06',
    },
    {
      title: '价格接近观察区',
      target: '中芯国际',
      level: '中',
      type: 'price',
      message: '接近前高压力位，等待缩量回踩或业绩催化。',
      time: '13:42',
    },
  ],
  marketCalendar: [
    { date: '周一', event: 'PMI 数据公布', impact: '影响顺周期与制造业风险偏好' },
    { date: '周三', event: '重点公司业绩预告', impact: '关注半导体与电力设备兑现度' },
    { date: '周五', event: '期权交割', impact: '指数波动率可能上升' },
  ],
  themes: [
    { name: 'AI 算力链', strength: 94, notes: '资金最集中，适合高低切观察。' },
    { name: '新型电力系统', strength: 86, notes: '政策与业绩共振，关注趋势延续。' },
    { name: '创新药出海', strength: 78, notes: '事件驱动密集，个股分化明显。' },
  ],
  memos: [
    {
      title: '仓位纪律',
      body: '强势行业追踪不超过 40% 仓位，单股首次建仓不超过 8%。',
    },
    {
      title: '复盘重点',
      body: '关注强势行业扩散是否从龙头转向二线补涨，避免后排缩量冲高。',
    },
  ],
};

export function getDashboardData(): DashboardData {
  return dashboardData;
}

export function getTrendIconName(trend: DashboardData['industries'][number]['trend']): string {
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
