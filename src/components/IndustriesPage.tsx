import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AlertTriangle, Factory, RefreshCw, Search } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { fetchIndustryCompanies } from '../data/industryService';
import { getChainBoardMatches, INDUSTRY_CHAINS } from '../data/industryTaxonomy';
import type { IndustryBoard, IndustryChain, IndustryCompany } from '../data/types';
import { buildIndustryBubbles, getIndustryBubbleBounds } from '../data/industryVisualization';
import { IndustryCanvasEditor } from './IndustryCanvasEditor';
import { createIndustryCanvas, type CanvasNode, type IndustryCanvas } from '../data/industryCanvas';
import { loadIndustryCanvases, saveIndustryCanvases } from '../data/industryCanvasStorage';

type IndustryView = 'market' | 'panorama' | 'chain';
type CompanySort = 'change' | 'capitalFlow' | 'marketCap';
type SortDirection = 'asc' | 'desc';
type CloudMetric = 'heat' | 'change';

export type IndustrySearchResult = {
  kind: 'industry' | 'chain-node' | 'company';
  id: string;
  label: string;
  detail: string;
  targetBoardCode?: string;
};

export function filterIndustryItems(
  query: string,
  boards: IndustryBoard[],
  chains: IndustryChain[],
  companies: IndustryCompany[],
): IndustrySearchResult[] {
  const needle = query.trim().toLocaleLowerCase('zh-CN');
  if (!needle) return [];

  const industries = boards
    .filter((board) => `${board.name} ${board.code}`.toLocaleLowerCase('zh-CN').includes(needle))
    .map((board): IndustrySearchResult => ({ kind: 'industry', id: board.code, label: board.name, detail: `行业 · ${board.code}` }));
  const nodes = chains.flatMap((chain) => chain.stages.flatMap((stage) => stage.nodes
    .filter((node) => `${node.name} ${node.matchKeywords.join(' ')}`.toLocaleLowerCase('zh-CN').includes(needle))
    .map((node): IndustrySearchResult => ({ kind: 'chain-node', id: `${chain.id}:${node.id}`, label: node.name, detail: `${chain.name} · ${stage.name}` }))));
  const stocks = companies
    .filter((company) => `${company.name} ${company.code} ${company.industry}`.toLocaleLowerCase('zh-CN').includes(needle))
    .map((company): IndustrySearchResult => ({ kind: 'company', id: company.code, label: company.name, detail: `${company.code} · ${company.industry}`, targetBoardCode: boards.find((board) => board.name === company.industry)?.code }));
  return [...industries, ...nodes, ...stocks];
}

export function sortIndustryCompanies(
  companies: IndustryCompany[],
  key: CompanySort,
  direction: SortDirection,
): IndustryCompany[] {
  return [...companies].sort((left, right) => {
    const leftValue = left[key];
    const rightValue = right[key];
    if (leftValue === null && rightValue === null) return 0;
    if (leftValue === null) return 1;
    if (rightValue === null) return -1;
    return direction === 'desc' ? rightValue - leftValue : leftValue - rightValue;
  });
}

export function getIndustryCloudSpan(board: IndustryBoard, metric: CloudMetric, boards: IndustryBoard[]): number {
  const values = boards.map((item) => metric === 'heat' ? item.heat : item.change);
  const value = metric === 'heat' ? board.heat : board.change;
  const min = Math.min(...values, value);
  const max = Math.max(...values, value);
  if (max === min) return 3;
  return Math.max(2, Math.min(8, 2 + Math.round(((value - min) / (max - min)) * 6)));
}

export function makeIndustryIndexNode(board: IndustryBoard, companies: IndustryCompany[]): CanvasNode {
  return {
    id: `industry-${board.code}`,
    name: board.name,
    stocks: companies.map((company) => ({ code: company.code, name: company.name, industry: company.industry, change: company.change, marketCap: company.marketCap, pe: company.pe })),
    children: [],
  };
}

export function findChainRouteForBoard(board: IndustryBoard, chains: IndustryChain[]): { chainId: string; nodeId: string } | null {
  const candidates: Array<{ chainId: string; nodeId: string; score: number }> = [];
  for (const chain of chains) {
    for (const stage of chain.stages) {
      for (const node of stage.nodes) {
        const score = node.boardCodes?.includes(board.code) ? 120 : node.name === board.name ? 100 : node.matchKeywords.includes(board.name) ? 90 : 0;
        if (score > 0) candidates.push({ chainId: chain.id, nodeId: node.id, score });
      }
    }
  }
  const bestScore = Math.max(...candidates.map((candidate) => candidate.score), 0);
  const best = candidates.filter((candidate) => candidate.score === bestScore);
  return best.length === 1 ? { chainId: best[0].chainId, nodeId: best[0].nodeId } : null;
}

function readRouteState() {
  const raw = window.location.hash.split('?')[1] ?? '';
  const params = new URLSearchParams(raw);
  const requestedView = params.get('industryView') ?? params.get('view');
  return {
    view: requestedView === 'panorama' || requestedView === 'chain' ? requestedView : 'market' as IndustryView,
    boardCode: params.get('industry'),
    chainId: params.get('chain') ?? 'new-energy-vehicle',
    nodeId: params.get('node'),
  };
}

function writeRouteState(view: IndustryView, boardCode: string | null, chainId: string, nodeId: string | null) {
  const params = new URLSearchParams();
  params.set('industryView', view);
  if (boardCode) params.set('industry', boardCode);
  if (view === 'chain') {
    params.set('chain', chainId);
    if (nodeId) params.set('node', nodeId);
  }
  const nextHash = `#industries?${params.toString()}`;
  if (window.location.hash !== nextHash) window.history.pushState(null, '', nextHash);
}

function formatOptional(value: number | null, digits = 2) {
  return value === null ? '—' : value.toFixed(digits);
}

function formatMarketCap(value: number | null) {
  if (value === null) return '—';
  return `${(value / 100_000_000).toFixed(value >= 100_000_000_000 ? 0 : 1)} 亿`;
}

export function IndustriesPage({ industries, onOpenPriceTool, onOpenIndexTool }: { industries: IndustryBoard[]; onOpenPriceTool?: (code: string, name: string) => void; onOpenIndexTool?: (node: import('../data/industryCanvas').CanvasNode, method: 'equal' | 'marketCap') => void }) {
  const route = useMemo(readRouteState, []);
  const [view, setView] = useState<IndustryView>(route.view);
  const [query, setQuery] = useState('');
  const [expandedBoards, setExpandedBoards] = useState<Set<string>>(new Set());
  const [selectedBoardCode, setSelectedBoardCode] = useState<string | null>(route.boardCode ?? industries[0]?.code ?? null);
  const [chainId, setChainId] = useState(route.chainId);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(route.nodeId);
  const [companies, setCompanies] = useState<IndustryCompany[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const [companiesError, setCompaniesError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<CompanySort>('change');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [cloudMetric, setCloudMetric] = useState<CloudMetric>('heat');
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(() => new Set(['upstream', 'midstream', 'downstream']));
  const [canvas, setCanvas] = useState<IndustryCanvas>(() => loadIndustryCanvases()[0] ?? createIndustryCanvas({ id: crypto.randomUUID(), name: '自定义产业链', root: { id: crypto.randomUUID(), name: '上游 / 中游 / 下游', stocks: [], children: [] } }));

  const chain = INDUSTRY_CHAINS.find((item) => item.id === chainId) ?? INDUSTRY_CHAINS[0];
  const selectedNode = chain?.stages.flatMap((stage) => stage.nodes).find((node) => node.id === selectedNodeId);
  const chainMatches = selectedNode ? getChainBoardMatches(chain.id, selectedNode.id, industries) : [];
  const selectedBoard = industries.find((board) => board.code === selectedBoardCode) ?? null;
  const activeBoardCode = view === 'chain' ? (selectedBoard && chainMatches.some((item) => item.code === selectedBoard.code) ? selectedBoard.code : chainMatches[0]?.code ?? null) : selectedBoardCode;
  const activeBoard = industries.find((board) => board.code === activeBoardCode) ?? null;

  const cloudBoards = useMemo(() => [...industries].sort((left, right) => (cloudMetric === 'heat' ? right.heat - left.heat : right.change - left.change)), [industries, cloudMetric]);
  const bubbles = useMemo(() => buildIndustryBubbles(cloudBoards, cloudMetric, 920, Math.max(300, Math.ceil(cloudBoards.length / 8) * 120)), [cloudBoards, cloudMetric]);
  const bubbleBounds = useMemo(() => getIndustryBubbleBounds(bubbles), [bubbles]);
  const sortedCompanies = useMemo(() => sortIndustryCompanies(companies, sortKey, sortDirection), [companies, sortKey, sortDirection]);
  const searchResults = useMemo(() => filterIndustryItems(query, industries, INDUSTRY_CHAINS, companies).slice(0, 10), [query, industries, companies]);

  useEffect(() => {
    writeRouteState(view, activeBoardCode, chain.id, selectedNodeId);
  }, [view, activeBoardCode, chain.id, selectedNodeId]);

  useEffect(() => {
    const handlePopState = () => {
      const next = readRouteState();
      setView(next.view);
      setChainId(next.chainId);
      setSelectedNodeId(next.nodeId);
      setSelectedBoardCode(next.boardCode);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  useEffect(() => {
    if (view === 'market' || !activeBoardCode) {
      setCompanies([]);
      return;
    }
    let active = true;
    setCompaniesLoading(true);
    setCompaniesError(null);
    fetchIndustryCompanies(activeBoardCode)
      .then((rows) => { if (active) setCompanies(rows); })
      .catch((error) => { if (active) setCompaniesError(error instanceof Error ? error.message : '公司数据加载失败'); })
      .finally(() => { if (active) setCompaniesLoading(false); });
    return () => { active = false; };
  }, [view, activeBoardCode]);

  function chooseSearchResult(result: IndustrySearchResult) {
    if (result.kind === 'industry') {
      setView('panorama');
      setSelectedBoardCode(result.id);
    } else if (result.kind === 'chain-node') {
      const [nextChainId, nextNodeId] = result.id.split(':');
      setView('chain');
      setChainId(nextChainId);
      setSelectedNodeId(nextNodeId);
      setSelectedBoardCode(null);
    } else {
      setView('panorama');
      setSelectedBoardCode(result.targetBoardCode ?? null);
    }
    setQuery('');
  }

  function retryCompanies(boardCode: string | null) {
    if (!boardCode) return;
    setCompaniesLoading(true);
    setCompaniesError(null);
    fetchIndustryCompanies(boardCode)
      .then(setCompanies)
      .catch((error) => setCompaniesError(error instanceof Error ? error.message : '公司数据加载失败'))
      .finally(() => setCompaniesLoading(false));
  }

  function toggleSort(key: CompanySort) {
    if (sortKey === key) setSortDirection((current) => current === 'desc' ? 'asc' : 'desc');
    else { setSortKey(key); setSortDirection('desc'); }
  }

  function selectChainTheme(nextChainId: string) {
    const nextChain = INDUSTRY_CHAINS.find((item) => item.id === nextChainId);
    setChainId(nextChainId);
    setSelectedNodeId(nextChain?.stages[0]?.nodes[0]?.id ?? null);
    setSelectedBoardCode(null);
    setView('chain');
  }

  return (
    <section className="panel industry-workbench" id="industries">
      <div className="industry-workbench__heading">
        <SectionHeader icon={Factory} eyebrow="Industry Research" title="行业全景与产业链研究" />
        <div className="industry-search">
          <Search size={16} aria-hidden="true" />
          <input aria-label="搜索行业、产业链或公司" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索行业、产业链节点或已加载公司" />
          {searchResults.length > 0 ? <div className="industry-search__results">{searchResults.map((result) => <button type="button" key={`${result.kind}-${result.id}`} onClick={() => chooseSearchResult(result)}><strong>{result.label}</strong><small>{result.detail}</small></button>)}</div> : null}
        </div>
      </div>

      <div className="industry-view-tabs" role="tablist" aria-label="行业研究视图">
        {([['market', '最新行情'], ['panorama', '行业全景'], ['chain', '产业链主题']] as const).map(([key, label]) => (
          <button type="button" role="tab" aria-selected={view === key} className={view === key ? 'is-active' : ''} onClick={() => setView(key)} key={key}>{label}</button>
        ))}
      </div>

      {view === 'market' ? (
        <div className="industry-market-view">
          <div className="industry-summary-strip">
            <span><small>行业覆盖</small><strong>{industries.length} 个</strong></span>
            <span><small>上涨行业</small><strong className="positive">{industries.filter((item) => item.change > 0).length}</strong></span>
            <span><small>资金净流入</small><strong>{industries.filter((item) => item.capitalFlow > 0).length} 个</strong></span>
            <span><small>最热行业</small><strong>{[...industries].sort((a, b) => b.heat - a.heat)[0]?.name ?? '—'}</strong></span>
          </div>
          <div className="industry-cloud-toolbar"><span>行业云图</span><small>点击行业进入产业链或行业详情</small><div><button type="button" className={cloudMetric === 'heat' ? 'is-active' : ''} onClick={() => setCloudMetric('heat')}>按热度</button><button type="button" className={cloudMetric === 'change' ? 'is-active' : ''} onClick={() => setCloudMetric('change')}>按涨幅</button></div></div>
          <div className="industry-cloud-legend"><span><i className="industry-cloud-legend__up" />上涨</span><span><i className="industry-cloud-legend__down" />下跌</span><span>面积 = {cloudMetric === 'heat' ? '热度' : '涨跌幅'}</span></div>
          <div className="industry-bubble-map" aria-label="行业行情气泡图"><svg viewBox={`0 0 ${bubbleBounds.width} ${bubbleBounds.height}`} role="img"><defs><filter id="industry-bubble-glow" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="5" /></filter></defs>{bubbles.map((bubble, index) => { const board = cloudBoards.find((item) => item.code === bubble.code)!; const route = findChainRouteForBoard(board, INDUSTRY_CHAINS); const activate = () => { if (route) { setChainId(route.chainId); setSelectedNodeId(route.nodeId); setSelectedBoardCode(null); setView('chain'); } else { setSelectedBoardCode(board.code); setView('panorama'); } }; return <g key={board.code} className={`industry-bubble industry-bubble--${bubble.tone}${index < 3 ? ' industry-bubble--featured' : ''}`} tabIndex={0} role="button" onClick={activate} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(); } }}><title>{`${board.name} ${board.change >= 0 ? '+' : ''}${board.change.toFixed(2)}%`}</title>{index < 3 ? <circle className="industry-bubble__halo" cx={bubble.x} cy={bubble.y} r={bubble.r + 8} /> : null}<circle cx={bubble.x} cy={bubble.y} r={bubble.r} /><text x={bubble.x} y={bubble.y - 4}>{board.name.slice(0, 6)}</text><text x={bubble.x} y={bubble.y + 13}>{`${board.change >= 0 ? '+' : ''}${board.change.toFixed(2)}%`}</text></g>; })}</svg></div>
        </div>
      ) : null}

      {view === 'panorama' ? (
        <div className="industry-panorama">
          <aside className="industry-directory"><p>行业树 · 涨跌数据为最近可用交易日 · 点击上级展开，叶节点查看成分公司</p><IndustryTree boards={industries} expanded={expandedBoards} selectedCode={activeBoardCode} onToggle={(code) => setExpandedBoards((current) => { const next = new Set(current); next.has(code) ? next.delete(code) : next.add(code); return next; })} onSelect={setSelectedBoardCode} /></aside>
          <IndustryCompanyPanel board={activeBoard} companies={sortedCompanies} loading={companiesLoading} error={companiesError} sortKey={sortKey} direction={sortDirection} onSort={toggleSort} onRetry={() => retryCompanies(activeBoardCode)} onPreviewIndex={(board, rows) => onOpenIndexTool?.(makeIndustryIndexNode(board, rows), 'equal')} />
        </div>
      ) : null}

      {view === 'chain' && chain ? (
        <div className="industry-chain-view">
          <div className="industry-hot-chains industry-hot-chains--top"><div><span>热门产业链</span><small>点击后刷新上中下游、匹配板块与公司标的</small></div><div>{INDUSTRY_CHAINS.map((item) => <button type="button" className={item.id === chain.id ? 'is-active' : ''} onClick={() => selectChainTheme(item.id)} key={item.id}>{item.name}</button>)}</div></div>
          <div className="industry-canvas-disclosure"><button type="button" className="industry-canvas-disclosure__toggle" aria-expanded={isCanvasOpen} onClick={() => setIsCanvasOpen((current) => !current)}><span><strong>我的产业链</strong><small>新建、编辑、保存或加载分享链接</small></span><b>{isCanvasOpen ? '收起 −' : '展开 +'}</b></button>{isCanvasOpen ? <IndustryCanvasEditor canvas={canvas} onChange={setCanvas} onSave={(next) => { setCanvas(next); saveIndustryCanvases([next]); }} onStock={onOpenPriceTool} onBranch={onOpenIndexTool} /> : null}</div>
          <div className="industry-chain-intro"><div><span>投资主题</span><h3>{chain.name}</h3><p>{chain.summary}</p></div><small>主题标签允许一家公司出现在多个节点，不等同于互斥行业分类。</small></div>
          <div className="industry-mindmap" aria-label={`${chain.name}产业链思维导图`}><div className="industry-mindmap__root"><span>产业链主题</span><strong>{chain.name}</strong></div><div className="industry-mindmap__branches">{chain.stages.map((stage, stageIndex) => { const isOpen = expandedStages.has(stage.id); return <section className={`industry-mindmap__branch industry-mindmap__branch--${stage.id}`} key={stage.id}><button type="button" className="industry-mindmap__stage" aria-expanded={isOpen} onClick={() => setExpandedStages((current) => { const next = new Set(current); isOpen ? next.delete(stage.id) : next.add(stage.id); return next; })}><span>{String(stageIndex + 1).padStart(2, '0')}</span><div><strong>{stage.name}</strong><small>{stage.nodes.length} 个细分环节</small></div><b>{isOpen ? '−' : '+'}</b></button>{isOpen ? <div className="industry-mindmap__nodes">{stage.nodes.map((node) => <button type="button" className={selectedNodeId === node.id ? 'is-active' : ''} onClick={() => { setSelectedNodeId(node.id); setSelectedBoardCode(null); }} key={node.id}><strong>{node.name}</strong><small>{node.description}</small></button>)}</div> : null}</section>; })}</div></div>
          {selectedNode ? <div className="industry-chain-detail"><div className="industry-chain-detail__boards"><span>匹配行情板块</span>{chainMatches.length > 0 ? chainMatches.map((board) => <button type="button" className={activeBoardCode === board.code ? 'is-active' : ''} onClick={() => setSelectedBoardCode(board.code)} key={board.code}>{board.name}<small>{board.code}</small></button>) : <p>当前行情分类中未匹配到板块，产业链知识结构仍可正常浏览。</p>}</div><IndustryCompanyPanel board={activeBoard} companies={sortedCompanies} loading={companiesLoading} error={companiesError} sortKey={sortKey} direction={sortDirection} onSort={toggleSort} onRetry={() => retryCompanies(activeBoardCode)} onPreviewIndex={(board, rows) => onOpenIndexTool?.(makeIndustryIndexNode(board, rows), 'equal')} /></div> : <div className="industry-empty"><Factory size={28} /><strong>选择一个产业链节点</strong><p>查看对应细分板块和真实上市公司。</p></div>}
        </div>
      ) : null}

      <footer className="industry-disclaimer">行业行情来自公开实时接口；产业链为研究归纳，不构成投资建议。分类口径与公司归属可能随主营业务和指数规则调整。</footer>
    </section>
  );
}

function IndustryTree({ boards, expanded, selectedCode, onToggle, onSelect }: { boards: IndustryBoard[]; expanded: Set<string>; selectedCode: string | null; onToggle: (code: string) => void; onSelect: (code: string) => void }) {
  const children = (parentCode?: string) => boards.filter((board) => board.parentCode === parentCode);
  const roots = boards.filter((board) => board.level === 1 || !board.parentCode);
  const render = (board: IndustryBoard, depth: number): ReactNode => {
    const nested = children(board.code);
    const hasChildren = nested.length > 0;
    const open = expanded.has(board.code);
    return <li key={board.code}><button type="button" className={selectedCode === board.code ? 'is-active' : ''} style={{ paddingLeft: `${12 + depth * 16}px` }} onClick={() => hasChildren ? onToggle(board.code) : onSelect(board.code)}><span>{hasChildren ? (open ? '▾ ' : '▸ ') : '• '}{board.name}<small>{board.code}</small></span><b className={board.change >= 0 ? 'positive' : 'negative'}>{board.change >= 0 ? '+' : ''}{board.change.toFixed(2)}%</b></button>{hasChildren && open ? <ul>{nested.map((child) => render(child, depth + 1))}</ul> : null}</li>;
  };
  return <ul className="industry-tree" role="tree">{roots.map((board) => render(board, 0))}</ul>;
}

function IndustryCompanyPanel({ board, companies, loading, error, sortKey, direction, onSort, onRetry, onPreviewIndex }: { board: IndustryBoard | null; companies: IndustryCompany[]; loading: boolean; error: string | null; sortKey: CompanySort; direction: SortDirection; onSort: (key: CompanySort) => void; onRetry: () => void; onPreviewIndex?: (board: IndustryBoard, companies: IndustryCompany[]) => void }) {
  if (!board) return <div className="industry-empty"><Factory size={28} /><strong>请选择行业或细分板块</strong><p>成分公司将在选择后按需加载。</p></div>;
  return <section className="industry-company-panel"><header><div><span>板块详情</span><h3>{board.name}</h3><p>{board.momentum} · 主力净流入 {board.capitalFlow >= 0 ? '+' : ''}{board.capitalFlow.toFixed(2)} 亿</p></div><div className="industry-company-panel__actions">{companies.length > 0 ? <button type="button" onClick={() => onPreviewIndex?.(board, companies)}>预览行业指数</button> : null}<b className={board.change >= 0 ? 'positive' : 'negative'}>{board.change >= 0 ? '+' : ''}{board.change.toFixed(2)}%</b></div></header>{loading ? <div className="industry-state"><RefreshCw className="spin" size={20} /><span>正在加载板块成分公司…</span></div> : error ? <div className="industry-state industry-state--error"><AlertTriangle size={20} /><span>{error}</span><button type="button" onClick={onRetry}>重试</button></div> : companies.length === 0 ? <div className="industry-state"><span>该板块暂未返回成分公司。</span></div> : <div className="industry-company-table"><div className="industry-company-table__head"><span>公司</span><button type="button" onClick={() => onSort('change')}>涨跌幅 {sortKey === 'change' ? direction === 'desc' ? '↓' : '↑' : ''}</button><button type="button" onClick={() => onSort('capitalFlow')}>资金流 {sortKey === 'capitalFlow' ? direction === 'desc' ? '↓' : '↑' : ''}</button><button type="button" onClick={() => onSort('marketCap')}>市值 {sortKey === 'marketCap' ? direction === 'desc' ? '↓' : '↑' : ''}</button><span>现价</span></div>{companies.map((company) => <div className="industry-company-row" key={company.code}><span><strong>{company.name}</strong><small>{company.code} · {company.industry}</small></span><b className={(company.change ?? 0) >= 0 ? 'positive' : 'negative'}>{company.change === null ? '—' : `${company.change >= 0 ? '+' : ''}${company.change.toFixed(2)}%`}</b><b>{company.capitalFlow === null ? '—' : `${company.capitalFlow >= 0 ? '+' : ''}${company.capitalFlow.toFixed(2)} 亿`}</b><b>{formatMarketCap(company.marketCap)}</b><b>{formatOptional(company.price)}</b></div>)}</div>}</section>;
}
