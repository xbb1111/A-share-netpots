export const SENTIMENT_METRIC_DEFINITIONS = [
  { id: 'turnover', name: '换手率', unit: '%', direction: 'higher-hot', source: '东方财富公开行情', formula: '有效 A 股自由流通市值加权换手率', interpretation: '高：交易活跃、情绪升温；低：交投清淡、情绪偏冷。' },
  { id: 'top3IndustryShare', name: 'TOP3 行业成交额占比', unit: '%', direction: 'higher-hot', source: '东方财富公开行情', formula: '成交额前三行业合计 ÷ 全市场成交额', interpretation: '高：资金集中于少数主线、情绪偏热；低：成交分散、主线不突出。' },
  { id: 'risingShare', name: '上涨个股占比', unit: '%', direction: 'higher-hot', source: '东方财富公开行情', formula: '上涨股票数 ÷ 当日有效股票数', interpretation: '高：赚钱效应覆盖面广、情绪偏热；低：亏钱效应扩散、情绪偏冷。' },
  { id: 'aboveMa20Share', name: '个股站上 MA20 占比', unit: '%', direction: 'higher-hot', source: '东方财富公开行情', formula: '收盘价高于 20 日简单均线股票数 ÷ MA20 有效股票数', interpretation: '高：中期趋势覆盖面强、情绪偏热；低：多数个股趋势偏弱、情绪偏冷。' },
  { id: 'marginBuyShare', name: '融资买入额占比', unit: '%', direction: 'higher-hot', source: '东方财富两融汇总 / 国证A指', formula: '沪深两市融资买入额 ÷ A 股成交额', interpretation: '高：杠杆资金加速入场、风险偏好升温；低：融资参与减弱、情绪偏冷。' },
  { id: 'erp', name: '风险溢价 ERP', unit: '%', direction: 'lower-hot', source: '国证A指 / 中债国债收益率曲线', formula: '100 ÷ 国证A指滚动市盈率 − 10 年期国债收益率', interpretation: '高：风险补偿要求高、风险偏好低；低：风险偏好高、情绪偏热。' },
];

export function percentileRank(values, current) {
  const finite = values.filter(Number.isFinite);
  if (!Number.isFinite(current) || finite.length === 0) return null;
  return round((finite.filter((value) => value <= current).length / finite.length) * 100, 1);
}

export function emotionPercentile(id, values, current) {
  const rank = percentileRank(values, current);
  return rank === null ? null : id === 'erp' ? round(100 - rank, 1) : rank;
}

export function getEmotionZone(percentile) {
  if (!Number.isFinite(percentile)) return '数据不足';
  if (percentile < 20) return '极度恐慌';
  if (percentile < 40) return '偏冷';
  if (percentile < 60) return '中性';
  if (percentile < 80) return '偏热';
  return '极度贪婪';
}

export function buildSentimentPayload(rows, options = {}) {
  const sorted = [...rows]
    .filter((row) => row?.date)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-252);
  const definitions = options.definitions ?? SENTIMENT_METRIC_DEFINITIONS;
  const metrics = definitions.map((definition) => {
    const series = sorted
      .filter((row) => Number.isFinite(row[definition.id]))
      .map((row, index, available) => {
        const priorValues = available.slice(Math.max(0, index - 251), index + 1).map((item) => item[definition.id]);
        const percentile252 = emotionPercentile(definition.id, priorValues, row[definition.id]);
        return {
          date: row.date,
          value: round(row[definition.id], 4),
          percentile252,
          ...(definition.id === 'risingShare' ? {
            rising0To5Share: round(row.rising0To5Share, 4),
            rising5To10Share: round(row.rising5To10Share, 4),
            risingAbove10Share: round(row.risingAbove10Share, 4),
          } : {}),
          ...(definition.id === 'top3IndustryShare' ? {
            top3Industries: row.top3Industries ?? [],
            totalAmountYi: round(row.totalAmountYi, 2),
          } : {}),
        };
      });
    const latest = series.at(-1);
    return {
      ...definition,
      value: latest?.value ?? null,
      percentile252: latest?.percentile252 ?? null,
      zone: getEmotionZone(latest?.percentile252),
      series,
    };
  });
  const commonAsOf = sorted.at(-1)?.date ?? null;
  return {
    commonAsOf,
    updatedAt: options.updatedAt ?? new Date().toISOString(),
    stale: Boolean(options.stale),
    methodology: '公开数据代理口径；六项独立展示，不合成总分。',
    metrics,
  };
}

export function mergeSentimentRows(baseRows, nextRow) {
  if (!nextRow?.date) return [...baseRows];
  const byDate = new Map(baseRows.map((row) => [row.date, row]));
  byDate.set(nextRow.date, { ...(byDate.get(nextRow.date) ?? {}), ...nextRow });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-252);
}

function round(value, digits) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
