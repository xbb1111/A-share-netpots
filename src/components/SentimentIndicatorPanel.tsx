import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SectionHeader } from './SectionHeader';
import { clampSentimentRange, fetchSentimentSnapshot, type SentimentMetric, type SentimentPoint, type SentimentSnapshot, type SentimentTheme } from '../data/sentimentService';

const DEFAULT_WINDOW = 120;

export function SentimentIndicatorPanel() {
  const [snapshot, setSnapshot] = useState<SentimentSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState({ start: 0, end: 0 });

  async function load(refresh = false) {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchSentimentSnapshot(refresh);
      setSnapshot(next);
      const length = Math.max(...next.metrics.map((metric) => metric.series.length));
      setRange({ start: Math.max(0, length - DEFAULT_WINDOW), end: Math.max(0, length - 1) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '情绪指标加载失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void load(); }, []);

  const maxLength = useMemo(() => Math.max(0, ...(snapshot?.metrics.map((metric) => metric.series.length) ?? [])), [snapshot]);
  const dateSeries = snapshot?.metrics[0]?.series ?? [];
  const startDate = dateSeries[range.start]?.date ?? '-';
  const endDate = dateSeries[range.end]?.date ?? '-';

  function updateRange(value: number, changed: 'start' | 'end') {
    setRange((current) => clampSentimentRange(changed === 'start' ? value : current.start, changed === 'end' ? value : current.end, maxLength, changed));
  }

  return (
    <section className="sentiment-tool panel" aria-label="情绪指标">
      <div className="sentiment-tool__heading">
        <SectionHeader icon={Activity} eyebrow="Market Sentiment" title="情绪指标" />
        <button type="button" className="sentiment-refresh" disabled={loading} onClick={() => void load(true)}>
          <RefreshCw size={15} className={loading ? 'spin' : undefined} />
          {loading ? '正在载入' : '重新载入'}
        </button>
      </div>

      <div className="sentiment-status">
        <span>统一数据日 <strong>{snapshot?.commonAsOf ?? '—'}</strong></span>
        <span>主题数据日 <strong>{snapshot?.themeAsOf ?? '—'}</strong></span>
        {snapshot?.marketAsOf && snapshot.marketAsOf !== snapshot.commonAsOf ? <span>市场最新日 <strong>{snapshot.marketAsOf}</strong></span> : null}
        {Number.isFinite(snapshot?.industryMappingCoverage) ? <span>行业标签覆盖 <strong>{Number(snapshot?.industryMappingCoverage).toFixed(2)}%</strong></span> : null}
        <span>{snapshot?.stale ? '数据更新异常，请关注数据日' : snapshot?.dataLagTradingDays ? '六项指标采用最近完整交易日' : '六项指标已对齐'}</span>
        <span>一级行业互斥归类 · 主题不计入占比</span>
      </div>

      {error ? <div className="sentiment-error"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => void load()}>重试</button></div> : null}

      {snapshot && maxLength > 0 ? (
        <div className="sentiment-range" aria-label="六项指标全局时间范围">
          <div><strong>横轴范围</strong><span>{startDate} 至 {endDate} · {range.end - range.start + 1} 个交易日</span></div>
          <label><span>起点</span><input type="range" min={0} max={Math.max(0, maxLength - 1)} value={range.start} onChange={(event) => updateRange(Number(event.target.value), 'start')} /></label>
          <label><span>终点</span><input type="range" min={0} max={Math.max(0, maxLength - 1)} value={range.end} onChange={(event) => updateRange(Number(event.target.value), 'end')} /></label>
        </div>
      ) : null}

      {snapshot ? <div className="sentiment-grid">{snapshot.metrics.map((metric) => <SentimentCard key={metric.id} metric={metric} start={range.start} end={range.end} topThemes={snapshot.topThemes ?? []} themeAsOf={snapshot.themeAsOf ?? null} industryClassification={snapshot.industryClassification ?? null} />)}</div> : loading ? <div className="sentiment-loading">正在读取最近完整交易日…</div> : null}

      <p className="sentiment-disclaimer">指标依据渤海证券研报六项框架拆分展示。行业采用申万一级互斥归类；热门主题成分可能重叠，仅展示成交额、不参与占比计算。公开数据与 iFinD 在样本和估值口径上可能存在差异；仅供研究参考，不构成投资建议。
      </p>
    </section>
  );
}

function SentimentCard({ metric, start, end, topThemes, themeAsOf, industryClassification }: { metric: SentimentMetric; start: number; end: number; topThemes: SentimentTheme[]; themeAsOf: string | null; industryClassification: string | null }) {
  const data = metric.series.slice(start, end + 1);
  const tone = zoneTone(metric.zone);
  const showRisingBands = metric.id === 'risingShare';
  return (
    <article className={`sentiment-card sentiment-card--${tone}`}>
      <header>
        <div><span>{metric.name}</span><strong>{formatValue(metric.value, metric.unit)}</strong></div>
        <b>{metric.zone}</b>
      </header>
      <div className="sentiment-card__meta"><span>252日情绪分位</span><strong>{metric.percentile252 === null ? '—' : `${metric.percentile252.toFixed(1)}%`}</strong></div>
      <div className="sentiment-chart" aria-label={`${metric.name}历史趋势`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: showRisingBands ? 0 : 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,.09)" vertical={false} />
            <XAxis dataKey="date" minTickGap={42} tick={{ fill: '#7f8f9d', fontSize: 10 }} tickFormatter={(value: string) => value.slice(5)} />
            {showRisingBands ? (
              <>
                <YAxis yAxisId="breadth" width={42} domain={[0, 100]} tick={{ fill: '#d6aa5c', fontSize: 10 }} tickFormatter={(value: number) => `${value}`} />
                <YAxis yAxisId="surge" orientation="right" width={42} domain={[0, (maximum: number) => Math.max(10, Math.ceil(maximum / 5) * 5)]} tick={{ fill: '#d46b73', fontSize: 10 }} tickFormatter={(value: number) => `${value}`} />
              </>
            ) : <YAxis width={42} domain={['auto', 'auto']} tick={{ fill: '#7f8f9d', fontSize: 10 }} tickFormatter={(value: number) => Number(value).toFixed(metric.id === 'erp' ? 1 : 0)} />}
            <Tooltip content={(props) => <SentimentChartTooltip active={props.active} payload={props.payload as unknown as readonly TooltipEntry[] | undefined} label={String(props.label ?? '')} metric={metric} topThemes={topThemes} themeAsOf={themeAsOf} industryClassification={industryClassification} />} />
            {showRisingBands ? (
              <>
                <Legend verticalAlign="top" height={28} iconType="line" wrapperStyle={{ color: '#91a2ae', fontSize: 10 }} />
                <Line yAxisId="breadth" name="涨幅 0–5%（左轴）" type="monotone" dataKey="rising0To5Share" dot={false} stroke="#d6aa5c" strokeWidth={1.7} connectNulls />
                <Line yAxisId="surge" name="涨幅 5–10%（右轴）" type="monotone" dataKey="rising5To10Share" dot={false} stroke="#d46b73" strokeWidth={1.7} connectNulls />
                <Line yAxisId="surge" name="涨幅 10%以上（右轴）" type="monotone" dataKey="risingAbove10Share" dot={false} stroke="#8c72d9" strokeWidth={1.7} connectNulls />
              </>
            ) : <Line name={metric.name} type="monotone" dataKey="value" dot={false} stroke={toneColor(tone)} strokeWidth={1.8} connectNulls />}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <footer><span>{metric.interpretation}</span></footer>
    </article>
  );
}

type TooltipEntry = { name?: string; value?: number | string; color?: string; payload?: SentimentPoint };

function SentimentChartTooltip({ active, payload, label, metric, topThemes, themeAsOf, industryClassification }: { active?: boolean; payload?: readonly TooltipEntry[]; label: string; metric: SentimentMetric; topThemes: SentimentTheme[]; themeAsOf: string | null; industryClassification: string | null }) {
  if (!active || !payload?.length) return null;
  const point = payload.find((entry) => entry.payload)?.payload;
  return (
    <div className="sentiment-tooltip">
      <strong className="sentiment-tooltip__date">{label}</strong>
      <div className="sentiment-tooltip__values">
        {payload.map((entry) => <span key={entry.name} style={{ color: entry.color }}><i />{entry.name}：{formatValue(Number(entry.value), metric.unit)}</span>)}
      </div>
      {metric.id === 'top3IndustryShare' && point?.top3Industries?.length ? (
        <div className="sentiment-tooltip__industries">
          <p>{industryClassification ?? '申万一级行业'} · {label}</p>
          <div><span>{point.amountEstimated ? '估算' : ''}全市场</span><strong>{formatYi(point.totalAmountYi)}亿元</strong></div>
          {point.top3Industries.map((industry, index) => <div key={industry.name}><span>{index + 1}. {industry.name}</span><strong>{formatYi(industry.amountYi)}亿元 · {industry.share.toFixed(2)}%</strong></div>)}
        </div>
      ) : null}
      {metric.id === 'top3IndustryShare' && topThemes.length ? (
        <div className="sentiment-tooltip__themes">
          <p>热门主题 · {themeAsOf ?? '—'}（独立观察，不计入占比）</p>
          {topThemes.map((theme, index) => <div key={theme.name}><span>{index + 1}. {theme.name}</span><strong>{formatYi(theme.amountYi)}亿元</strong></div>)}
        </div>
      ) : null}
    </div>
  );
}

function formatValue(value: number | null, unit: string) { return value === null ? '—' : `${value.toFixed(2)}${unit}`; }
function formatYi(value: number | null | undefined) { return Number.isFinite(value) ? Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '—'; }
function zoneTone(zone: SentimentMetric['zone']) { if (zone === '极度恐慌' || zone === '偏冷') return 'cold'; if (zone === '偏热' || zone === '极度贪婪') return 'hot'; return 'neutral'; }
function toneColor(tone: string) { return tone === 'hot' ? '#d46b73' : tone === 'cold' ? '#4fb7aa' : '#d6aa5c'; }
