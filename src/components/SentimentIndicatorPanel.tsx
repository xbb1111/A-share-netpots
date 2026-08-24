import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, RefreshCw } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SectionHeader } from './SectionHeader';
import { clampSentimentRange, fetchSentimentSnapshot, type SentimentMetric, type SentimentSnapshot } from '../data/sentimentService';

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
          {loading ? '正在更新' : '手动刷新'}
        </button>
      </div>

      <div className="sentiment-status">
        <span>统一数据日 <strong>{snapshot?.commonAsOf ?? '—'}</strong></span>
        <span>{snapshot?.stale ? '已返回最近完整快照' : '六项指标已对齐'}</span>
        <span>公开数据代理口径 · 不合成总分</span>
      </div>

      {error ? <div className="sentiment-error"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => void load()}>重试</button></div> : null}

      {snapshot && maxLength > 0 ? (
        <div className="sentiment-range" aria-label="六项指标全局时间范围">
          <div><strong>横轴范围</strong><span>{startDate} 至 {endDate} · {range.end - range.start + 1} 个交易日</span></div>
          <label><span>起点</span><input type="range" min={0} max={Math.max(0, maxLength - 1)} value={range.start} onChange={(event) => updateRange(Number(event.target.value), 'start')} /></label>
          <label><span>终点</span><input type="range" min={0} max={Math.max(0, maxLength - 1)} value={range.end} onChange={(event) => updateRange(Number(event.target.value), 'end')} /></label>
        </div>
      ) : null}

      {snapshot ? <div className="sentiment-grid">{snapshot.metrics.map((metric) => <SentimentCard key={metric.id} metric={metric} start={range.start} end={range.end} />)}</div> : loading ? <div className="sentiment-loading">正在读取最近完整交易日…</div> : null}

      <p className="sentiment-disclaimer">指标依据渤海证券研报六项框架拆分展示。公开数据与 iFinD 在样本、行业分类和估值口径上可能存在差异；仅供研究参考，不构成投资建议。
      </p>
    </section>
  );
}

function SentimentCard({ metric, start, end }: { metric: SentimentMetric; start: number; end: number }) {
  const data = metric.series.slice(start, end + 1);
  const tone = zoneTone(metric.zone);
  return (
    <article className={`sentiment-card sentiment-card--${tone}`}>
      <header>
        <div><span>{metric.name}</span><strong>{formatValue(metric.value, metric.unit)}</strong></div>
        <b>{metric.zone}</b>
      </header>
      <div className="sentiment-card__meta"><span>252日情绪分位</span><strong>{metric.percentile252 === null ? '—' : `${metric.percentile252.toFixed(1)}%`}</strong></div>
      <div className="sentiment-chart" aria-label={`${metric.name}历史趋势`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgba(148,163,184,.09)" vertical={false} />
            <XAxis dataKey="date" minTickGap={42} tick={{ fill: '#7f8f9d', fontSize: 10 }} tickFormatter={(value: string) => value.slice(5)} />
            <YAxis width={42} domain={['auto', 'auto']} tick={{ fill: '#7f8f9d', fontSize: 10 }} tickFormatter={(value: number) => Number(value).toFixed(metric.id === 'erp' ? 1 : 0)} />
            <Tooltip contentStyle={{ background: '#0a151d', border: '1px solid rgba(94,182,201,.28)', borderRadius: 8 }} labelStyle={{ color: '#d7e1e8' }} formatter={(value) => [formatValue(Number(value), metric.unit), metric.name]} />
            <Line type="monotone" dataKey="value" dot={false} stroke={toneColor(tone)} strokeWidth={1.8} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <footer><span>{metric.formula}</span><small>来源：{metric.source}</small></footer>
    </article>
  );
}

function formatValue(value: number | null, unit: string) { return value === null ? '—' : `${value.toFixed(2)}${unit}`; }
function zoneTone(zone: SentimentMetric['zone']) { if (zone === '极度恐慌' || zone === '偏冷') return 'cold'; if (zone === '偏热' || zone === '极度贪婪') return 'hot'; return 'neutral'; }
function toneColor(tone: string) { return tone === 'hot' ? '#d46b73' : tone === 'cold' ? '#4fb7aa' : '#d6aa5c'; }
