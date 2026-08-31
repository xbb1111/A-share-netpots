import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Landmark, RefreshCw } from 'lucide-react';
import { CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SectionHeader } from './SectionHeader';
import { addNormalizedOverlays, capitalWindow, fetchLargeCapitalSnapshot, sortCapitalMembers, type CapitalMember, type CapitalProduct, type LargeCapitalSnapshot } from '../data/largeCapitalService';

type Tab = 'national' | 'institutions';
type MemberMode = 'long' | 'short' | 'netLong' | 'netShort';
const WINDOWS = [20, 60, 120, 252] as const;

export function LargeCapitalFlowPanel() {
  const [snapshot, setSnapshot] = useState<LargeCapitalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNote, setRefreshNote] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('national');
  const [windowSize, setWindowSize] = useState<(typeof WINDOWS)[number]>(60);
  const [indexId, setIndexId] = useState('all');
  const [etfCode, setEtfCode] = useState('510300');
  const [showNationalBenchmark, setShowNationalBenchmark] = useState(false);
  const [productId, setProductId] = useState<CapitalProduct['id']>('IF');
  const [showInstitutionBenchmark, setShowInstitutionBenchmark] = useState(true);
  const [memberMode, setMemberMode] = useState<MemberMode>('netLong');
  const [memberName, setMemberName] = useState<string | null>(null);

  async function load(manual = false) {
    setLoading(true);
    setError(null);
    if (manual) setRefreshNote(null);
    try {
      const next = await fetchLargeCapitalSnapshot(fetch, manual);
      setSnapshot(next);
      if (manual) setRefreshNote(`已检查云端快照，最新数据日 ${next.asOf ?? '—'}`);
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : '大资金动向加载失败'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  const selectedGroup = snapshot?.nationalTeam.indexGroups.find((group) => group.id === indexId) ?? snapshot?.nationalTeam.indexGroups[0];
  const selectedProduct = snapshot?.institutions.products.find((product) => product.id === productId) ?? snapshot?.institutions.products[0];
  const selectedMember = selectedProduct?.members.find((member) => member.name === memberName) ?? selectedProduct?.members[0];

  useEffect(() => { setMemberName(null); }, [productId]);

  return (
    <section className="capital-tool panel" aria-label="大资金动向">
      <div className="capital-tool__heading">
        <SectionHeader icon={Landmark} eyebrow="Large Capital Flow" title="大资金动向" />
        <button type="button" className="capital-refresh" disabled={loading} onClick={() => void load(true)}><RefreshCw size={15} className={loading ? 'spin' : undefined} />{loading ? '正在检查' : '检查最新快照'}</button>
      </div>
      <div className="capital-status"><strong>{snapshot?.status ?? '读取数据中'}</strong><span>统一数据日 {snapshot?.asOf ?? '—'}</span><span className={snapshot?.stale ? 'is-stale' : ''}>{snapshot?.stale ? '快照可能陈旧' : '快照有效'}</span>{refreshNote ? <span>{refreshNote}</span> : null}</div>
      <div className="capital-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'national'} onClick={() => setTab('national')}><Landmark size={15} />国家队动向</button>
        <button type="button" role="tab" aria-selected={tab === 'institutions'} onClick={() => setTab('institutions')}><Building2 size={15} />机构动向</button>
      </div>
      <div className="capital-window" aria-label="时间范围">{WINDOWS.map((value) => <button key={value} type="button" className={windowSize === value ? 'active' : ''} onClick={() => setWindowSize(value)}>{value}日</button>)}</div>
      {error ? <div className="capital-error"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => void load()}>重试</button></div> : null}
      {!error && !snapshot && loading ? <div className="capital-loading">正在读取交易所公开数据快照…</div> : null}
      {snapshot && tab === 'national' ? <NationalTeamView snapshot={snapshot} windowSize={windowSize} selectedGroup={selectedGroup} indexId={indexId} setIndexId={setIndexId} etfCode={etfCode} setEtfCode={setEtfCode} showBenchmark={showNationalBenchmark} setShowBenchmark={setShowNationalBenchmark} /> : null}
      {snapshot && tab === 'institutions' ? <InstitutionView snapshot={snapshot} windowSize={Math.min(windowSize, 120)} product={selectedProduct} productId={productId} setProductId={setProductId} memberMode={memberMode} setMemberMode={setMemberMode} member={selectedMember} setMemberName={setMemberName} showBenchmark={showInstitutionBenchmark} setShowBenchmark={setShowInstitutionBenchmark} /> : null}
      {snapshot ? <p className="capital-disclaimer">{tab === 'national' ? snapshot.nationalTeam.disclaimer : snapshot.institutions.disclaimer} 仅供研究观察，不构成投资建议。</p> : null}
    </section>
  );
}

function NationalTeamView({ snapshot, windowSize, selectedGroup, indexId, setIndexId, etfCode, setEtfCode, showBenchmark, setShowBenchmark }: { snapshot: LargeCapitalSnapshot; windowSize: number; selectedGroup: LargeCapitalSnapshot['nationalTeam']['indexGroups'][number] | undefined; indexId: string; setIndexId: (id: string) => void; etfCode: string; setEtfCode: (code: string) => void; showBenchmark: boolean; setShowBenchmark: (value: boolean) => void }) {
  const availableEtfs = snapshot.nationalTeam.etfs.filter((etf) => indexId === 'all' || etf.indexId === indexId);
  const selectedEtf = availableEtfs.find((etf) => etf.code === etfCode) ?? availableEtfs[0];
  const benchmarkId = indexId === 'all' ? selectedEtf?.indexId : indexId;
  const benchmark = snapshot.benchmarks.find((item) => item.id === benchmarkId);
  const chartData = addNormalizedOverlays(capitalWindow(selectedGroup?.series ?? [], windowSize), [
    { key: 'etfTrend', series: (selectedEtf?.series ?? []).map((point) => ({ date: point.date, value: point.nav })) },
    ...(showBenchmark && benchmark ? [{ key: 'benchmarkTrend', series: benchmark.series.map((point) => ({ date: point.date, value: point.close })) }] : []),
  ]);
  return (
    <div className="capital-body">
      <div className="capital-kpis">
        <CapitalKpi label="当日估算净申购" value={snapshot.nationalTeam.summaries.day1} />
        <CapitalKpi label="近5日估算净申购" value={snapshot.nationalTeam.summaries.day5} />
        <CapitalKpi label="近20日估算净申购" value={snapshot.nationalTeam.summaries.day20} />
        <CapitalKpi label="核心 ETF 覆盖" text={`${snapshot.nationalTeam.etfs.length}/12`} />
      </div>
      <div className="capital-controls"><div className="capital-control-group"><label><span>指数分组</span><select value={indexId} onChange={(event) => setIndexId(event.target.value)}>{snapshot.nationalTeam.indexGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><label><span>叠加 ETF</span><select value={selectedEtf?.code ?? ''} onChange={(event) => setEtfCode(event.target.value)}>{availableEtfs.map((etf) => <option key={etf.code} value={etf.code}>{etf.name} · {etf.code}</option>)}</select></label><label className="capital-toggle"><input type="checkbox" checked={showBenchmark} disabled={!benchmark} onChange={(event) => setShowBenchmark(event.target.checked)} /><span>叠加{benchmark?.name ?? '对应指数'}</span></label></div><span>数据日 {snapshot.nationalTeam.asOf ?? '—'}</span></div>
      <div className="capital-chart" aria-label={`${selectedGroup?.name ?? ''}资金流与市场走势`}><ResponsiveContainer width="100%" height="100%"><LineChart data={chartData}><CartesianGrid stroke="rgba(148,163,184,.1)" vertical={false} /><XAxis dataKey="date" minTickGap={34} tickFormatter={shortDate} tick={{ fill: '#7f8f9d', fontSize: 10 }} /><YAxis yAxisId="flow" tick={{ fill: '#7f8f9d', fontSize: 10 }} width={48} /><YAxis yAxisId="trend" orientation="right" tick={{ fill: '#7f8f9d', fontSize: 10 }} width={46} domain={['auto', 'auto']} /><Tooltip contentStyle={tooltipStyle} formatter={capitalTooltipFormatter} labelFormatter={(value) => `交易日 ${value}`} /><Legend wrapperStyle={{ fontSize: 11 }} /><ReferenceLine yAxisId="flow" y={0} stroke="#52616d" /><Line yAxisId="flow" type="monotone" dataKey="netFlowYi" name="估算净申购（亿元）" dot={false} connectNulls stroke="#d6aa5c" strokeWidth={1.8} /><Line yAxisId="trend" type="monotone" dataKey="etfTrend" name={`${selectedEtf?.name ?? 'ETF'}（起点=100）`} dot={false} connectNulls stroke="#4fb7aa" strokeWidth={1.7} />{showBenchmark && benchmark ? <Line yAxisId="trend" type="monotone" dataKey="benchmarkTrend" name={`${benchmark.name}（起点=100）`} dot={false} connectNulls stroke="#7aa2f7" strokeWidth={1.6} strokeDasharray="5 3" /> : null}</LineChart></ResponsiveContainer></div>
      <div className="capital-table-wrap"><table className="capital-table"><thead><tr><th>ETF</th><th>跟踪指数</th><th>份额</th><th>份额变化</th><th>估算净申购</th><th>成交额</th><th>数据日</th></tr></thead><tbody>{snapshot.nationalTeam.etfs.map((etf) => <tr key={etf.code}><td><strong>{etf.name}</strong><span>{etf.code}</span></td><td>{etf.indexName}</td><td>{formatShares(etf.shares)}</td><td className={tone(etf.shareChange)}>{formatShares(etf.shareChange)}</td><td className={tone(etf.netFlowYi)}>{formatYi(etf.netFlowYi)}</td><td>{formatYi(etf.amountYi)}</td><td>{etf.asOf ?? '—'}{etf.qualityFlags.length ? <small title={etf.qualityFlags.join(', ')}> 数据提示</small> : null}</td></tr>)}</tbody></table></div>
      <div className="capital-events"><h3>官方增持公告</h3>{snapshot.nationalTeam.events.map((event) => <a key={`${event.date}-${event.title}`} href={event.url} target="_blank" rel="noreferrer"><time>{event.date}</time><div><strong>{event.title}</strong><span>{event.summary}</span></div></a>)}</div>
    </div>
  );
}

function InstitutionView({ snapshot, windowSize, product, productId, setProductId, memberMode, setMemberMode, member, setMemberName, showBenchmark, setShowBenchmark }: { snapshot: LargeCapitalSnapshot; windowSize: number; product: CapitalProduct | undefined; productId: CapitalProduct['id']; setProductId: (id: CapitalProduct['id']) => void; memberMode: MemberMode; setMemberMode: (mode: MemberMode) => void; member: CapitalMember | undefined; setMemberName: (name: string) => void; showBenchmark: boolean; setShowBenchmark: (value: boolean) => void }) {
  const ranking = useMemo(() => sortCapitalMembers(product?.members ?? [], memberMode).slice(0, 20), [product, memberMode]);
  if (!product) return <div className="capital-loading">暂无中金所席位快照</div>;
  const latest = product.latest?.top20;
  const benchmark = snapshot.benchmarks.find((item) => item.id === product.benchmarkId);
  const memberChartData = member ? addNormalizedOverlays(capitalWindow(member.history, windowSize), showBenchmark && benchmark ? [{ key: 'benchmarkTrend', series: benchmark.series.map((point) => ({ date: point.date, value: point.close })) }] : []) : [];
  return (
    <div className="capital-body">
      <div className="capital-product-tabs">{snapshot.institutions.products.map((item) => <button key={item.id} type="button" className={productId === item.id ? 'active' : ''} onClick={() => setProductId(item.id)}><strong>{item.id}</strong><span>{item.name.replace('股指期货', '')}</span></button>)}</div>
      <div className="capital-kpis"><CapitalKpi label="前20披露持多" text={formatLots(latest?.long)} /><CapitalKpi label="前20披露持空" text={formatLots(latest?.short)} /><CapitalKpi label="前20披露净头寸" text={formatLots(latest?.net)} toneValue={latest?.net} /><CapitalKpi label="披露多空比" text={latest?.longShortRatio?.toFixed(3) ?? '—'} /></div>
      <div className="capital-controls"><span>合约 {product.contracts.join('、') || '—'}</span><span>数据日 {product.asOf ?? '—'}</span></div>
      <div className="capital-institution-grid">
        <section><div className="capital-section-heading"><h3>会员席位排行</h3><select value={memberMode} onChange={(event) => setMemberMode(event.target.value as MemberMode)}><option value="long">持多</option><option value="short">持空</option><option value="netLong">披露净多</option><option value="netShort">披露净空</option></select></div><div className="capital-member-list">{ranking.map((item, index) => <button key={item.name} type="button" className={member?.name === item.name ? 'active' : ''} onClick={() => setMemberName(item.name)}><i>{index + 1}</i><span><strong>{item.name}</strong><small>{memberDisclosure(item)}</small></span><b className={tone(memberValue(item, memberMode))}>{formatLots(memberValue(item, memberMode))}</b></button>)}</div></section>
        <section><div className="capital-section-heading"><h3>{member?.name ?? '会员'} · 披露趋势</h3><div className="capital-section-actions"><label className="capital-toggle"><input type="checkbox" checked={showBenchmark} disabled={!benchmark} onChange={(event) => setShowBenchmark(event.target.checked)} /><span>叠加{benchmark?.name ?? '对应指数'}</span></label><span>最多120日</span></div></div>{member ? <div className="capital-member-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={memberChartData}><CartesianGrid stroke="rgba(148,163,184,.1)" vertical={false} /><XAxis dataKey="date" minTickGap={28} tickFormatter={shortDate} tick={{ fill: '#7f8f9d', fontSize: 10 }} /><YAxis yAxisId="positions" tick={{ fill: '#7f8f9d', fontSize: 10 }} width={50} /><YAxis yAxisId="trend" orientation="right" tick={{ fill: '#7f8f9d', fontSize: 10 }} width={46} domain={['auto', 'auto']} hide={!showBenchmark} /><Tooltip contentStyle={tooltipStyle} formatter={capitalTooltipFormatter} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line yAxisId="positions" type="monotone" dataKey="long" name="披露持多（手）" dot={false} stroke="#d46b73" /><Line yAxisId="positions" type="monotone" dataKey="short" name="披露持空（手）" dot={false} stroke="#4fb7aa" /><Line yAxisId="positions" type="monotone" dataKey="net" name="披露净头寸（手）" dot={false} stroke="#d6aa5c" />{showBenchmark && benchmark ? <Line yAxisId="trend" type="monotone" dataKey="benchmarkTrend" name={`${benchmark.name}（起点=100）`} dot={false} connectNulls stroke="#7aa2f7" strokeWidth={1.7} strokeDasharray="5 3" /> : null}</LineChart></ResponsiveContainer></div> : <div className="capital-loading">请选择会员席位</div>}</section>
      </div>
    </div>
  );
}

function CapitalKpi({ label, value, text, toneValue }: { label: string; value?: number | null; text?: string; toneValue?: number | null }) { const displayed = text ?? formatYi(value); const colorValue = toneValue ?? value; return <article><span>{label}</span><strong className={tone(colorValue)}>{displayed}</strong></article>; }
function memberDisclosure(member: CapitalMember) { if (!member.hasLong) return '多单未进前20'; if (!member.hasShort) return '空单未进前20'; return '多空均有披露'; }
function memberValue(member: CapitalMember, mode: MemberMode) { if (mode === 'long') return member.long; if (mode === 'short') return member.short; return member.net; }
function formatYi(value: number | null | undefined) { return Number.isFinite(value) ? `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}亿元` : '—'; }
function formatShares(value: number | null | undefined) { return Number.isFinite(value) ? `${(Number(value) / 1e8).toLocaleString('zh-CN', { maximumFractionDigits: 2 })}亿份` : '—'; }
function formatLots(value: number | null | undefined) { return Number.isFinite(value) ? `${Number(value).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}手` : '—'; }
function formatNumber(value: number) { return Number.isFinite(value) ? value.toLocaleString('zh-CN', { maximumFractionDigits: 2 }) : '—'; }
function capitalTooltipFormatter(value: unknown, name: string | number | undefined): [string, string] { return [formatNumber(Number(value)), String(name ?? '')]; }
function shortDate(value: string) { return value?.slice(5) ?? value; }
function tone(value: number | null | undefined) { return !Number.isFinite(value) || value === 0 ? '' : Number(value) > 0 ? 'is-positive' : 'is-negative'; }
const tooltipStyle = { background: '#101820', border: '1px solid #273542', borderRadius: 6, color: '#dbe5ee', fontSize: 11 };
