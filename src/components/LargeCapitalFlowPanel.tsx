import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Building2, Landmark, RefreshCw } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { SectionHeader } from './SectionHeader';
import { capitalWindow, fetchLargeCapitalSnapshot, sortCapitalMembers, type CapitalMember, type CapitalProduct, type LargeCapitalSnapshot } from '../data/largeCapitalService';

type Tab = 'national' | 'institutions';
type MemberMode = 'long' | 'short' | 'netLong' | 'netShort';
const WINDOWS = [20, 60, 120, 252] as const;

export function LargeCapitalFlowPanel() {
  const [snapshot, setSnapshot] = useState<LargeCapitalSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('national');
  const [windowSize, setWindowSize] = useState<(typeof WINDOWS)[number]>(60);
  const [indexId, setIndexId] = useState('all');
  const [productId, setProductId] = useState<CapitalProduct['id']>('IF');
  const [memberMode, setMemberMode] = useState<MemberMode>('netLong');
  const [memberName, setMemberName] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try { setSnapshot(await fetchLargeCapitalSnapshot()); }
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
        <button type="button" className="capital-refresh" disabled={loading} onClick={() => void load()}><RefreshCw size={15} className={loading ? 'spin' : undefined} />{loading ? '正在载入' : '重新载入'}</button>
      </div>
      <div className="capital-status"><strong>{snapshot?.status ?? '读取数据中'}</strong><span>统一数据日 {snapshot?.asOf ?? '—'}</span><span className={snapshot?.stale ? 'is-stale' : ''}>{snapshot?.stale ? '快照可能陈旧' : '快照有效'}</span></div>
      <div className="capital-tabs" role="tablist">
        <button type="button" role="tab" aria-selected={tab === 'national'} onClick={() => setTab('national')}><Landmark size={15} />国家队动向</button>
        <button type="button" role="tab" aria-selected={tab === 'institutions'} onClick={() => setTab('institutions')}><Building2 size={15} />机构动向</button>
      </div>
      <div className="capital-window" aria-label="时间范围">{WINDOWS.map((value) => <button key={value} type="button" className={windowSize === value ? 'active' : ''} onClick={() => setWindowSize(value)}>{value}日</button>)}</div>
      {error ? <div className="capital-error"><AlertTriangle size={17} /><span>{error}</span><button type="button" onClick={() => void load()}>重试</button></div> : null}
      {!error && !snapshot && loading ? <div className="capital-loading">正在读取交易所公开数据快照…</div> : null}
      {snapshot && tab === 'national' ? <NationalTeamView snapshot={snapshot} windowSize={windowSize} selectedGroup={selectedGroup} indexId={indexId} setIndexId={setIndexId} /> : null}
      {snapshot && tab === 'institutions' ? <InstitutionView snapshot={snapshot} windowSize={Math.min(windowSize, 120)} product={selectedProduct} productId={productId} setProductId={setProductId} memberMode={memberMode} setMemberMode={setMemberMode} member={selectedMember} setMemberName={setMemberName} /> : null}
      {snapshot ? <p className="capital-disclaimer">{tab === 'national' ? snapshot.nationalTeam.disclaimer : snapshot.institutions.disclaimer} 仅供研究观察，不构成投资建议。</p> : null}
    </section>
  );
}

function NationalTeamView({ snapshot, windowSize, selectedGroup, indexId, setIndexId }: { snapshot: LargeCapitalSnapshot; windowSize: number; selectedGroup: LargeCapitalSnapshot['nationalTeam']['indexGroups'][number] | undefined; indexId: string; setIndexId: (id: string) => void }) {
  const chartData = capitalWindow(selectedGroup?.series ?? [], windowSize);
  return (
    <div className="capital-body">
      <div className="capital-kpis">
        <CapitalKpi label="当日估算净申购" value={snapshot.nationalTeam.summaries.day1} />
        <CapitalKpi label="近5日估算净申购" value={snapshot.nationalTeam.summaries.day5} />
        <CapitalKpi label="近20日估算净申购" value={snapshot.nationalTeam.summaries.day20} />
        <CapitalKpi label="核心 ETF 覆盖" text={`${snapshot.nationalTeam.etfs.length}/12`} />
      </div>
      <div className="capital-controls"><label><span>指数分组</span><select value={indexId} onChange={(event) => setIndexId(event.target.value)}>{snapshot.nationalTeam.indexGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label><span>数据日 {snapshot.nationalTeam.asOf ?? '—'}</span></div>
      <div className="capital-chart" aria-label={`${selectedGroup?.name ?? ''}资金流趋势`}><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}><CartesianGrid stroke="rgba(148,163,184,.1)" vertical={false} /><XAxis dataKey="date" minTickGap={34} tickFormatter={shortDate} tick={{ fill: '#7f8f9d', fontSize: 10 }} /><YAxis tick={{ fill: '#7f8f9d', fontSize: 10 }} width={48} /><Tooltip contentStyle={tooltipStyle} formatter={(value) => [`${formatNumber(Number(value))}亿元`, '估算净申购']} labelFormatter={(value) => `交易日 ${value}`} /><ReferenceLine y={0} stroke="#52616d" /><Bar dataKey="netFlowYi" name="估算净申购" fill="#d6aa5c" radius={[3, 3, 0, 0]} /></BarChart></ResponsiveContainer></div>
      <div className="capital-table-wrap"><table className="capital-table"><thead><tr><th>ETF</th><th>跟踪指数</th><th>份额</th><th>份额变化</th><th>估算净申购</th><th>成交额</th><th>数据日</th></tr></thead><tbody>{snapshot.nationalTeam.etfs.map((etf) => <tr key={etf.code}><td><strong>{etf.name}</strong><span>{etf.code}</span></td><td>{etf.indexName}</td><td>{formatShares(etf.shares)}</td><td className={tone(etf.shareChange)}>{formatShares(etf.shareChange)}</td><td className={tone(etf.netFlowYi)}>{formatYi(etf.netFlowYi)}</td><td>{formatYi(etf.amountYi)}</td><td>{etf.asOf ?? '—'}{etf.qualityFlags.length ? <small title={etf.qualityFlags.join(', ')}> 数据提示</small> : null}</td></tr>)}</tbody></table></div>
      <div className="capital-events"><h3>官方增持公告</h3>{snapshot.nationalTeam.events.map((event) => <a key={`${event.date}-${event.title}`} href={event.url} target="_blank" rel="noreferrer"><time>{event.date}</time><div><strong>{event.title}</strong><span>{event.summary}</span></div></a>)}</div>
    </div>
  );
}

function InstitutionView({ snapshot, windowSize, product, productId, setProductId, memberMode, setMemberMode, member, setMemberName }: { snapshot: LargeCapitalSnapshot; windowSize: number; product: CapitalProduct | undefined; productId: CapitalProduct['id']; setProductId: (id: CapitalProduct['id']) => void; memberMode: MemberMode; setMemberMode: (mode: MemberMode) => void; member: CapitalMember | undefined; setMemberName: (name: string) => void }) {
  const ranking = useMemo(() => sortCapitalMembers(product?.members ?? [], memberMode).slice(0, 20), [product, memberMode]);
  if (!product) return <div className="capital-loading">暂无中金所席位快照</div>;
  const latest = product.latest?.top20;
  return (
    <div className="capital-body">
      <div className="capital-product-tabs">{snapshot.institutions.products.map((item) => <button key={item.id} type="button" className={productId === item.id ? 'active' : ''} onClick={() => setProductId(item.id)}><strong>{item.id}</strong><span>{item.name.replace('股指期货', '')}</span></button>)}</div>
      <div className="capital-kpis"><CapitalKpi label="前20披露持多" text={formatLots(latest?.long)} /><CapitalKpi label="前20披露持空" text={formatLots(latest?.short)} /><CapitalKpi label="前20披露净头寸" text={formatLots(latest?.net)} toneValue={latest?.net} /><CapitalKpi label="披露多空比" text={latest?.longShortRatio?.toFixed(3) ?? '—'} /></div>
      <div className="capital-controls"><span>合约 {product.contracts.join('、') || '—'}</span><span>数据日 {product.asOf ?? '—'}</span></div>
      <div className="capital-chart" aria-label={`${product.id}前20席位趋势`}><ResponsiveContainer width="100%" height="100%"><LineChart data={capitalWindow(product.summarySeries, windowSize)}><CartesianGrid stroke="rgba(148,163,184,.1)" vertical={false} /><XAxis dataKey="date" minTickGap={34} tickFormatter={shortDate} tick={{ fill: '#7f8f9d', fontSize: 10 }} /><YAxis tick={{ fill: '#7f8f9d', fontSize: 10 }} width={54} /><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line type="monotone" dataKey="long" name="披露持多" dot={false} stroke="#d46b73" strokeWidth={1.7} /><Line type="monotone" dataKey="short" name="披露持空" dot={false} stroke="#4fb7aa" strokeWidth={1.7} /></LineChart></ResponsiveContainer></div>
      <div className="capital-institution-grid">
        <section><div className="capital-section-heading"><h3>会员席位排行</h3><select value={memberMode} onChange={(event) => setMemberMode(event.target.value as MemberMode)}><option value="long">持多</option><option value="short">持空</option><option value="netLong">披露净多</option><option value="netShort">披露净空</option></select></div><div className="capital-member-list">{ranking.map((item, index) => <button key={item.name} type="button" className={member?.name === item.name ? 'active' : ''} onClick={() => setMemberName(item.name)}><i>{index + 1}</i><span><strong>{item.name}</strong><small>{memberDisclosure(item)}</small></span><b className={tone(memberValue(item, memberMode))}>{formatLots(memberValue(item, memberMode))}</b></button>)}</div></section>
        <section><div className="capital-section-heading"><h3>{member?.name ?? '会员'} · 披露趋势</h3><span>最多120日</span></div>{member ? <div className="capital-member-chart"><ResponsiveContainer width="100%" height="100%"><LineChart data={capitalWindow(member.history, windowSize)}><CartesianGrid stroke="rgba(148,163,184,.1)" vertical={false} /><XAxis dataKey="date" minTickGap={28} tickFormatter={shortDate} tick={{ fill: '#7f8f9d', fontSize: 10 }} /><YAxis tick={{ fill: '#7f8f9d', fontSize: 10 }} width={50} /><Tooltip contentStyle={tooltipStyle} /><Legend wrapperStyle={{ fontSize: 11 }} /><Line type="monotone" dataKey="long" name="披露持多" dot={false} stroke="#d46b73" /><Line type="monotone" dataKey="short" name="披露持空" dot={false} stroke="#4fb7aa" /><Line type="monotone" dataKey="net" name="披露净头寸" dot={false} stroke="#d6aa5c" /></LineChart></ResponsiveContainer></div> : <div className="capital-loading">请选择会员席位</div>}</section>
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
function shortDate(value: string) { return value?.slice(5) ?? value; }
function tone(value: number | null | undefined) { return !Number.isFinite(value) || value === 0 ? '' : Number(value) > 0 ? 'is-positive' : 'is-negative'; }
const tooltipStyle = { background: '#101820', border: '1px solid #273542', borderRadius: 6, color: '#dbe5ee', fontSize: 11 };
