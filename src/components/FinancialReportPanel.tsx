import { useMemo, useState } from 'react';
import { AlertTriangle, BarChart3, FileSearch, Loader2, Search, Sparkles } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import {
  fetchFilingAnalysis,
  fetchFinancialFilings,
  searchReportSecurities,
} from '../data/financialReportService';
import type { FilingAnalysisResult, FilingSummary, FilingType, Security } from '../data/financialReports';

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
  const [status, setStatus] = useState<'idle' | 'searching' | 'loading-filings' | 'analyzing'>('idle');
  const [error, setError] = useState<string | null>(null);

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

          {analysis ? <AnalysisResultView analysis={analysis} /> : <AnalysisPlaceholder isBusy={isBusy} />}
        </div>
      </div>
    </section>
  );
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
        </section>

        <section>
          <h3>行业核验</h3>
          {analysis.industryChecklist.map((item) => <p key={item}>{item}</p>)}
        </section>
      </div>
    </div>
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
