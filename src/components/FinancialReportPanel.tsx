import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, ClipboardCopy, FileSearch, Loader2, Search, Sparkles } from 'lucide-react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { SectionHeader } from './SectionHeader';
import {
  fetchFilingAnalysis,
  fetchFinancialFilings,
  fetchFinancialMetrics,
  searchReportSecurities,
} from '../data/financialReportService';
import type {
  FilingAnalysisResult,
  FilingSummary,
  FilingType,
  FinancialMetricCatalogItem,
  FinancialMetricPeriod,
  FinancialMetricsResult,
  Security,
} from '../data/financialReports';

const FILING_TYPE_OPTIONS: Array<{ value: FilingType | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'annual', label: '年报' },
  { value: 'interim', label: '半年报' },
  { value: 'quarterly', label: '季报' },
  { value: 'earnings_preview', label: '业绩预告' },
];

const VERDICT_LABELS: Record<FilingAnalysisResult['verdict'], string> = {
  above: '超预期',
  in_line: '符合预期',
  below: '不及预期',
  mixed: '结果分化',
};

export function FinancialReportPanel() {
  const [query, setQuery] = useState('300750');
  const [selectedType, setSelectedType] = useState<FilingType | 'all'>('all');
  const [securities, setSecurities] = useState<Security[]>([]);
  const [selectedSecurity, setSelectedSecurity] = useState<Security | null>(null);
  const [filings, setFilings] = useState<FilingSummary[]>([]);
  const [selectedFilingId, setSelectedFilingId] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<FilingAnalysisResult | null>(null);
  const [metrics, setMetrics] = useState<FinancialMetricsResult | null>(null);
  const [metricPeriod, setMetricPeriod] = useState<FinancialMetricPeriod>('quarterly');
  const [selectedMetricId, setSelectedMetricId] = useState('netProfit');
  const [includePeers, setIncludePeers] = useState(false);
  const [status, setStatus] = useState<'idle' | 'searching' | 'loading-filings' | 'analyzing'>('idle');
  const [metricsStatus, setMetricsStatus] = useState<'idle' | 'loading'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const selectedFiling = useMemo(
    () => filings.find((filing) => filing.id === selectedFilingId) ?? null,
    [filings, selectedFilingId],
  );

  async function runSearch() {
    const trimmed = query.trim();

    if (!trimmed) {
      return;
    }

    setStatus('searching');
    setError(null);
    setAnalysis(null);

    try {
      const results = await searchReportSecurities(trimmed);
      const fallbackSecurity = /^\d{6}$/.test(trimmed) ? { code: trimmed, name: trimmed, industry: '未分类', exchange: 'UNKNOWN' as const } : null;
      const securitiesToShow = results.length > 0 ? results : fallbackSecurity ? [fallbackSecurity] : [];
      setSecurities(securitiesToShow);
      const first = securitiesToShow[0] ?? null;

      if (first) {
        await loadFilings(first);
      } else {
        setFilings([]);
        setSelectedSecurity(null);
        setSelectedFilingId(null);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '证券搜索失败');
    } finally {
      setStatus('idle');
    }
  }

  async function loadFilings(security: Security, type = selectedType) {
    setStatus('loading-filings');
    setError(null);
    setSelectedSecurity(security);
    setSelectedFilingId(null);
    setAnalysis(null);

    try {
      const nextFilings = await fetchFinancialFilings({ code: security.code, type });
      setFilings(nextFilings);
      setSelectedFilingId(nextFilings[0]?.id ?? null);
      void loadFinancialMetrics(security, metricPeriod, includePeers);
    } catch (caught) {
      setFilings([]);
      setError(caught instanceof Error ? caught.message : '公告列表加载失败');
    } finally {
      setStatus('idle');
    }
  }

  async function changeFilingType(type: FilingType | 'all') {
    setSelectedType(type);

    if (selectedSecurity) {
      await loadFilings(selectedSecurity, type);
    }
  }

  async function analyzeSelectedFiling(filing: FilingSummary | null = selectedFiling) {
    if (!selectedSecurity || !filing) {
      return;
    }

    setStatus('analyzing');
    setError(null);

    try {
      setAnalysis(await fetchFilingAnalysis({ code: selectedSecurity.code, filingId: filing.id }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '财报分析失败');
    } finally {
      setStatus('idle');
    }
  }

  async function loadFinancialMetrics(
    security: Security | null = selectedSecurity,
    period = metricPeriod,
    withPeers = includePeers,
  ) {
    if (!security) {
      return;
    }

    setMetricsStatus('loading');
    setMetricsError(null);

    try {
      const nextMetrics = await fetchFinancialMetrics({
        code: security.code,
        period,
        includePeers: withPeers,
        peerCount: 5,
      });
      setMetrics(nextMetrics);

      if (!nextMetrics.metricCatalog.some((metric) => metric.id === selectedMetricId)) {
        setSelectedMetricId(nextMetrics.metricCatalog[0]?.id ?? 'netProfit');
      }
    } catch (caught) {
      setMetrics(null);
      setMetricsError(caught instanceof Error ? caught.message : '财务指标加载失败');
    } finally {
      setMetricsStatus('idle');
    }
  }

  async function changeMetricPeriod(period: FinancialMetricPeriod) {
    setMetricPeriod(period);
    await loadFinancialMetrics(selectedSecurity, period, includePeers);
  }

  async function togglePeerComparison(checked: boolean) {
    setIncludePeers(checked);
    await loadFinancialMetrics(selectedSecurity, metricPeriod, checked);
  }

  const isBusy = status !== 'idle';

  return (
    <section className="panel financial-report-tool">
      <SectionHeader icon={FileSearch} eyebrow="Financial Reports" title="财报与业绩预告分析" />

      <div className="financial-report-tool__search">
        <label>
          <span>公司代码或名称</span>
          <div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  void runSearch();
                }
              }}
              placeholder="例如：300750 或 宁德时代"
            />
            <button type="button" onClick={() => void runSearch()} disabled={isBusy}>
              {status === 'searching' ? <Loader2 size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
              检索
            </button>
          </div>
        </label>

        <label>
          <span>文件类型</span>
          <select value={selectedType} onChange={(event) => void changeFilingType(event.target.value as FilingType | 'all')}>
            {FILING_TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="financial-report-tool__error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="financial-report-tool__layout">
        <aside className="financial-report-tool__rail">
          <div className="security-picks">
            {securities.map((security) => (
              <button
                className={selectedSecurity?.code === security.code ? 'security-picks__item security-picks__item--active' : 'security-picks__item'}
                key={security.code}
                type="button"
                onClick={() => void loadFilings(security)}
              >
                <strong>{security.name}</strong>
                <span>{security.code} · {security.industry}</span>
              </button>
            ))}
          </div>

          <div className="filing-list">
            {filings.length > 0 ? (
              filings.map((filing) => (
                <button
                  className={selectedFilingId === filing.id ? 'filing-list__item filing-list__item--active' : 'filing-list__item'}
                  key={filing.id}
                  type="button"
                  onClick={() => {
                    setSelectedFilingId(filing.id);
                    setAnalysis(null);
                  }}
                >
                  <strong>{filing.title}</strong>
                  <span>{filing.reportDate} · {getFilingTypeLabel(filing.type)}</span>
                </button>
              ))
            ) : (
              <div className="financial-report-tool__empty">输入公司后显示财报和业绩预告列表。</div>
            )}
          </div>
        </aside>

        <div className="financial-report-tool__main">
          <div className="filing-action">
            <div>
              <span>当前文件</span>
              <strong>{selectedFiling?.title ?? '尚未选择文件'}</strong>
            </div>
            <button type="button" onClick={() => void analyzeSelectedFiling()} disabled={!selectedFiling || isBusy}>
              {status === 'analyzing' ? <Loader2 size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
              分析财报
            </button>
          </div>

          <FinancialMetricsPanel
            includePeers={includePeers}
            isLoading={metricsStatus === 'loading'}
            metrics={metrics}
            metricsError={metricsError}
            period={metricPeriod}
            selectedMetricId={selectedMetricId}
            onMetricChange={setSelectedMetricId}
            onPeerToggle={(checked) => void togglePeerComparison(checked)}
            onPeriodChange={(period) => void changeMetricPeriod(period)}
          />

          {analysis ? <AnalysisResultView analysis={analysis} /> : <AnalysisPlaceholder isBusy={isBusy} />}
        </div>
      </div>
    </section>
  );
}

type FinancialMetricsPanelProps = {
  includePeers: boolean;
  isLoading: boolean;
  metrics: FinancialMetricsResult | null;
  metricsError: string | null;
  period: FinancialMetricPeriod;
  selectedMetricId: string;
  onMetricChange: (metricId: string) => void;
  onPeerToggle: (checked: boolean) => void;
  onPeriodChange: (period: FinancialMetricPeriod) => void;
};

function FinancialMetricsPanel({
  includePeers,
  isLoading,
  metrics,
  metricsError,
  period,
  selectedMetricId,
  onMetricChange,
  onPeerToggle,
  onPeriodChange,
}: FinancialMetricsPanelProps) {
  const selectedMetric = metrics?.metricCatalog.find((metric) => metric.id === selectedMetricId) ?? metrics?.metricCatalog[0] ?? null;
  const categories = [...new Set(metrics?.metricCatalog.map((metric) => metric.category) ?? [])];
  const chartRows = useMemo(
    () => (metrics && selectedMetric ? buildMetricChartRows(metrics, selectedMetric.id) : []),
    [metrics, selectedMetric],
  );
  const recentRows = [...(metrics?.series[selectedMetric?.id ?? ''] ?? [])].slice(-8).reverse();

  return (
    <section className="financial-metrics-panel">
      <div className="financial-metrics-panel__header">
        <div>
          <span>FINANCIAL METRICS</span>
          <strong>财务指标</strong>
        </div>
        <div className="metric-controls">
          <div className="segmented-control" aria-label="财务周期">
            {(['quarterly', 'annual'] as FinancialMetricPeriod[]).map((item) => (
              <button
                className={period === item ? 'segmented-control__item segmented-control__item--active' : 'segmented-control__item'}
                key={item}
                type="button"
                onClick={() => onPeriodChange(item)}
              >
                {item === 'quarterly' ? '季度' : '年度'}
              </button>
            ))}
          </div>
          <label className="peer-toggle">
            <input type="checkbox" checked={includePeers} onChange={(event) => onPeerToggle(event.target.checked)} />
            <span>同行对比</span>
          </label>
        </div>
      </div>

      {metricsError ? (
        <div className="financial-report-tool__error" role="alert">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>{metricsError}</span>
        </div>
      ) : null}

      {metrics && selectedMetric ? (
        <>
          <div className="metric-picker">
            {categories.map((category) => (
              <div key={category}>
                <span>{category}</span>
                <div>
                  {metrics.metricCatalog
                    .filter((metric) => metric.category === category)
                    .map((metric) => (
                      <button
                        className={selectedMetric.id === metric.id ? 'metric-chip metric-chip--active' : 'metric-chip'}
                        key={metric.id}
                        type="button"
                        onClick={() => onMetricChange(metric.id)}
                      >
                        {metric.label}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>

          <div className="metric-chart-wrap">
            <ResponsiveContainer width="100%" height={320}>
              <ComposedChart data={chartRows} margin={{ left: 8, right: 10, top: 12, bottom: 8 }}>
                <CartesianGrid stroke="rgba(148, 163, 184, 0.12)" vertical={false} />
                <XAxis dataKey="period" tick={{ fill: '#91a1af', fontSize: 11 }} tickLine={false} axisLine={{ stroke: 'rgba(148, 163, 184, 0.18)' }} />
                <YAxis yAxisId="value" tick={{ fill: '#91a1af', fontSize: 11 }} tickFormatter={(value) => formatMetricAxis(Number(value), selectedMetric)} width={72} />
                <YAxis yAxisId="percent" orientation="right" tick={{ fill: '#91a1af', fontSize: 11 }} tickFormatter={(value) => `${Math.round(Number(value))}%`} width={52} />
                <Tooltip content={<FinancialMetricTooltip metric={selectedMetric} metrics={metrics} />} />
                <Legend wrapperStyle={{ color: '#9eb0be', fontSize: 12 }} />
                {selectedMetric.chartType === 'bar' ? (
                  <Bar yAxisId="value" dataKey="value" name={selectedMetric.label} fill="#d6aa5c" radius={[3, 3, 0, 0]} />
                ) : (
                  <Line yAxisId="value" type="monotone" dataKey="value" name={selectedMetric.label} stroke="#d6aa5c" strokeWidth={2.4} dot={false} />
                )}
                <Line yAxisId="percent" type="monotone" dataKey="yoy" name="同比" stroke="#c7646d" strokeWidth={1.8} dot={false} />
                <Line yAxisId="percent" type="monotone" dataKey="qoq" name="环比" stroke="#5eb6c9" strokeWidth={1.8} dot={false} />
                {includePeers && metrics.peers.map((peer, index) => (
                  <Line
                    dataKey={`peer_${peer.security.code}`}
                    dot={false}
                    key={peer.security.code}
                    name={peer.security.name}
                    stroke={PEER_COLORS[index % PEER_COLORS.length]}
                    strokeDasharray="4 4"
                    strokeWidth={1.2}
                    type="monotone"
                    yAxisId="value"
                  />
                ))}
                {includePeers ? (
                  <Line yAxisId="value" type="monotone" dataKey="peerMedian" name="同行中位数" stroke="#9ca3af" strokeWidth={1.5} dot={false} />
                ) : null}
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div className="metric-data-table">
            <div className="metric-data-table__head">
              <span>报告期</span>
              <span>{selectedMetric.label}</span>
              <span>同比</span>
              <span>环比</span>
              <span>同行中位数</span>
            </div>
            {recentRows.map((point) => {
              const benchmark = metrics.industryBenchmark[selectedMetric.id]?.find((item) => item.period === point.period);
              return (
                <div className="metric-data-table__row" key={point.period}>
                  <span>{point.period}</span>
                  <span>{formatMetricValue(point.value, selectedMetric)}</span>
                  <span>{formatPercent(point.yoy)}</span>
                  <span>{formatPercent(point.qoq)}</span>
                  <span>{formatMetricValue(benchmark?.median ?? null, selectedMetric)}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="financial-report-tool__empty">{isLoading ? '正在加载财务指标...' : '选择公司后显示季度/年度财务指标曲线。'}</div>
      )}
    </section>
  );
}

const PEER_COLORS = ['#8bc5ff', '#a7d68f', '#e5b56f', '#c6a7ff', '#f29aa0'];

function buildMetricChartRows(metrics: FinancialMetricsResult, metricId: string) {
  const current = metrics.series[metricId] ?? [];
  return current.map((point) => {
    const benchmark = metrics.industryBenchmark[metricId]?.find((item) => item.period === point.period);
    const row: Record<string, string | number | null> = {
      period: point.period,
      reportDate: point.reportDate,
      value: point.value,
      yoy: point.yoy,
      qoq: point.qoq,
      peerMedian: benchmark?.median ?? null,
    };

    metrics.peers.forEach((peer) => {
      const peerPoint = peer.series[metricId]?.find((item) => item.period === point.period);
      row[`peer_${peer.security.code}`] = peerPoint?.value ?? null;
      row[`peer_${peer.security.code}_yoy`] = peerPoint?.yoy ?? null;
      row[`peer_${peer.security.code}_qoq`] = peerPoint?.qoq ?? null;
    });

    return row;
  });
}

function FinancialMetricTooltip({
  active,
  label,
  metric,
  metrics,
  payload,
}: {
  active?: boolean;
  label?: string;
  metric: FinancialMetricCatalogItem;
  metrics: FinancialMetricsResult;
  payload?: Array<{ payload: Record<string, number | string | null> }>;
}) {
  if (!active || !payload?.[0]) {
    return null;
  }

  const row = payload[0].payload;

  return (
    <div className="metric-tooltip">
      <strong>{label}</strong>
      <span>{metric.label}：{formatMetricValue(row.value as number | null, metric)}</span>
      <span>同比：{formatPercent(row.yoy as number | null)} / 环比：{formatPercent(row.qoq as number | null)}</span>
      {row.peerMedian !== null ? <span>同行中位数：{formatMetricValue(row.peerMedian as number | null, metric)}</span> : null}
      {metrics.peers.map((peer) => (
        <span key={peer.security.code}>
          {peer.security.name}：{formatMetricValue(row[`peer_${peer.security.code}`] as number | null, metric)}
          {' '}同比 {formatPercent(row[`peer_${peer.security.code}_yoy`] as number | null)}
          {' '}环比 {formatPercent(row[`peer_${peer.security.code}_qoq`] as number | null)}
        </span>
      ))}
    </div>
  );
}

function formatMetricValue(value: number | null | undefined, metric: FinancialMetricCatalogItem) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '未取得';
  }

  if (metric.unit === '%') {
    return `${formatCompactNumber(value)}%`;
  }

  return `${formatCompactNumber(value)}${metric.unit}`;
}

function formatMetricAxis(value: number, metric: FinancialMetricCatalogItem) {
  if (metric.unit === '%') {
    return `${formatCompactNumber(value)}%`;
  }

  return formatCompactNumber(value);
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '未取得';
  }

  return `${value > 0 ? '+' : ''}${Math.round(value)}%`;
}

function formatCompactNumber(value: number) {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);

  if (abs >= 100000000) {
    return `${Math.round(rounded / 100000000)}亿`;
  }

  if (abs >= 10000) {
    return `${Math.round(rounded / 10000)}万`;
  }

  return `${rounded}`;
}

function AnalysisPlaceholder({ isBusy }: { isBusy: boolean }) {
  return (
    <div className="analysis-placeholder">
      <BarChart3 size={22} aria-hidden="true" />
      <div>
        <strong>{isBusy ? '正在处理公开数据' : '等待选择报告'}</strong>
        <p>分析结果会按预期差、利润质量、现金流、营运资本和行业模板输出，不会把缺失的一致预期当成真实数据。</p>
      </div>
    </div>
  );
}

function AnalysisResultView({ analysis }: { analysis: FilingAnalysisResult }) {
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  async function copyAiPrompt() {
    if (!analysis.methodology?.aiPrompt) {
      return;
    }

    await navigator.clipboard.writeText(analysis.methodology.aiPrompt);
    setCopiedPrompt(true);
    window.setTimeout(() => setCopiedPrompt(false), 1600);
  }

  return (
    <div className="analysis-result">
      <div className={`analysis-verdict analysis-verdict--${analysis.verdict}`}>
        <span>{VERDICT_LABELS[analysis.verdict]}</span>
        <strong>{analysis.score}</strong>
        <small>综合评分</small>
      </div>

      <div className="analysis-summary">
        <strong>{analysis.summary}</strong>
        <span>{analysis.expectationGap?.label ?? '暂无预期差数据'}</span>
      </div>

      <div className="analysis-columns">
        <section className="analysis-section--wide">
          <h3>分项评分</h3>
          {analysis.componentScores?.length ? (
            analysis.componentScores.map((component) => (
              <div className={`component-score component-score--${component.status}`} key={component.id}>
                <div>
                  <strong>{component.label}</strong>
                  <span>{component.score === null ? '数据缺失' : `${component.score}分`}</span>
                </div>
                <p>{component.detail}</p>
                <dl>
                  {component.data.map((item) => (
                    <div key={`${component.id}-${item.label}`}>
                      <dt>{item.label}</dt>
                      <dd>{renderDataValue(item.label, item.value)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))
          ) : (
            <p>暂无分项评分数据。</p>
          )}
        </section>

        {analysis.scoreBreakdown ? <ScoreBreakdownCard analysis={analysis} /> : null}

        <section>
          <h3>正向驱动</h3>
          {analysis.bullishDrivers.length > 0 ? (
            analysis.bullishDrivers.map((item) => <p key={item}>{item}</p>)
          ) : (
            <p>暂无明确正向驱动。</p>
          )}
        </section>

        <section>
          <h3>风险雷点</h3>
          {analysis.riskFlags.length > 0 ? (
            analysis.riskFlags.map((flag) => (
              <p className={`risk-flag risk-flag--${flag.severity}`} key={flag.id}>
                {flag.label}
                {flag.value ? <span>数据：{flag.value}</span> : null}
                {flag.benchmark ? <span>阈值：{flag.benchmark}</span> : null}
              </p>
            ))
          ) : (
            <p>暂未识别高优先级雷点。</p>
          )}
        </section>

        <section>
          <h3>分析方法</h3>
          <p>{analysis.methodology?.engine ?? '规则引擎 v1（未接入 AI 模型）'}</p>
          <p>{analysis.methodology?.expectationStandard ?? '当前版本按公开公告、业绩预告字段和风险规则打分。'}</p>
          {analysis.methodology?.rules.map((rule) => <p key={rule}>{rule}</p>)}
          {analysis.methodology?.aiPrompt ? (
            <div className="ai-prompt-box">
              <div>
                <strong>免费 AI 复核</strong>
                <span>复制提示词到任意 AI，让它基于本页结构化数据二次分析，不需要本站接入付费模型。</span>
              </div>
              <button type="button" onClick={() => void copyAiPrompt()}>
                <ClipboardCopy size={15} aria-hidden="true" />
                {copiedPrompt ? '已复制' : '复制提示词'}
              </button>
            </div>
          ) : null}
        </section>

        <section>
          <h3>行业核验</h3>
          {analysis.industryChecklist.map((item) => <p key={item}>{item}</p>)}
        </section>
      </div>
    </div>
  );
}

function ScoreBreakdownCard({ analysis }: { analysis: FilingAnalysisResult }) {
  const breakdown = analysis.scoreBreakdown;

  if (!breakdown) {
    return null;
  }

  const maxWaterfall = Math.max(...breakdown.waterfall.map((item) => Math.abs(item.value)), 1);

  return (
    <section className="analysis-section--wide score-breakdown">
      <h3>评分计算</h3>
      <div className="score-formula">{breakdown.formula}</div>

      <div className="score-breakdown__summary">
        <div>
          <span>分项均值</span>
          <strong>{Math.round(breakdown.componentAverage)}分</strong>
        </div>
        <div>
          <span>缺失项惩罚</span>
          <strong>-{Math.round(breakdown.missingPenalty)}分</strong>
        </div>
        <div>
          <span>高风险惩罚</span>
          <strong>-{Math.round(breakdown.highRiskPenalty)}分</strong>
        </div>
        <div>
          <span>最终得分</span>
          <strong>{Math.round(breakdown.finalScore)}分</strong>
        </div>
      </div>

      <div className="score-breakdown__table">
        <div className="score-breakdown__table-head">
          <span>分项</span>
          <span>得分</span>
          <span>权重</span>
          <span>规则与依据</span>
        </div>
        {breakdown.rows.map((row) => (
          <div className={`score-breakdown__table-row score-breakdown__table-row--${row.status}`} key={row.id}>
            <span>{row.label}</span>
            <span>{row.score === null ? '缺失' : `${Math.round(row.score)}分`}</span>
            <span>{Math.round(row.weight * 100)}%</span>
            <span>
              <strong>{row.rule}</strong>
              <small>{row.evidence}</small>
            </span>
          </div>
        ))}
      </div>

      <div className="score-waterfall" aria-label="评分瀑布拆解">
        {breakdown.waterfall.map((item) => {
          const width = `${Math.max((Math.abs(item.value) / maxWaterfall) * 100, 6)}%`;
          return (
            <div className="score-waterfall__row" key={item.label}>
              <span>{item.label}</span>
              <div>
                <i className={item.value < 0 ? 'score-waterfall__bar score-waterfall__bar--negative' : 'score-waterfall__bar'} style={{ width }} />
              </div>
              <strong>{item.value > 0 ? '+' : ''}{Math.round(item.value)}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function getFilingTypeLabel(type: FilingType) {
  return FILING_TYPE_OPTIONS.find((option) => option.value === type)?.label ?? '其他';
}

function renderDataValue(label: string, value: string) {
  if (/^https?:\/\//i.test(value)) {
    return (
      <a href={value} target="_blank" rel="noreferrer">
        {label.includes('文件') ? '打开PDF' : value}
      </a>
    );
  }

  return value;
}
