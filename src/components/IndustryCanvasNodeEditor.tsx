import { useEffect, useRef, useState } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { addCanvasChild, addCanvasSibling, addStockToCanvasNode, collectBranchStocks, getBranchMetrics, removeCanvasNode, removeStockFromCanvasNode, renameCanvasNode, updateCanvasNodeDescription, updateCanvasStock, type CanvasNode, type IndustryCanvas, type CanvasStock } from '../data/industryCanvas';
import { getComputableBranchStocks } from '../data/industryIndexPreview';
import { searchSecuritySuggestions, type SecuritySuggestion } from '../data/priceDiscipline';
import { fetchSecurityMetrics } from '../data/customIndexService';

export function getCanvasNodeEditorState(node: CanvasNode) {
  const branchStocks = collectBranchStocks(node);
  const metrics = getBranchMetrics(node);
  const previewable = getComputableBranchStocks(node);
  const marketCapIncludedCount = previewable.filter((stock) => typeof stock.marketCap === 'number' && Number.isFinite(stock.marketCap) && stock.marketCap > 0).length;
  return {
    directCompanyCount: node.stocks.length,
    branchCompanyCount: branchStocks.length,
    metrics,
    peIncludedCount: metrics.peCompanyCount,
    peTotalCount: metrics.companyCount,
    marketCapIncludedCount,
    marketCapTotalCount: branchStocks.length,
    previewableCompanyCount: previewable.length,
    canUseMarketCap: marketCapIncludedCount > 0,
    hasPreviewableCompanies: previewable.length > 0,
  };
}

export type CanvasWeightMethod = 'equal' | 'marketCap';
export function resolveCanvasWeightMethod(method: CanvasWeightMethod, state: { hasPreviewableCompanies: boolean; canUseMarketCap: boolean }): CanvasWeightMethod {
  return method === 'marketCap' && (!state.hasPreviewableCompanies || !state.canUseMarketCap) ? 'equal' : method;
}

export function createLatestAsyncGuard() {
  let sequence = 0; let mounted = true;
  return { next: () => ++sequence, isCurrent: (token: number) => mounted && token === sequence, dispose: () => { mounted = false; sequence += 1; } };
}

type Props = { canvas: IndustryCanvas; node: CanvasNode; path: CanvasNode[]; onChange: (canvas: IndustryCanvas) => void; onClose: () => void; onSelect?: (id: string) => void; onStock?: (code: string, name: string) => void; onBranch?: (node: CanvasNode, method: CanvasWeightMethod, path: CanvasNode[]) => void; focusName?: boolean };

export function IndustryCanvasNodeEditor({ canvas, node, path, onChange, onClose, onSelect, onStock, onBranch, focusName }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SecuritySuggestion[]>([]);
  const [addError, setAddError] = useState('');
  const [addingCode, setAddingCode] = useState('');
  const [weight, setWeight] = useState<CanvasWeightMethod>('equal');
  const [nameDraft, setNameDraft] = useState(node.name);
  const [descriptionDraft, setDescriptionDraft] = useState(node.description ?? '');
  const searchGuard = useRef(createLatestAsyncGuard());
  const latestCanvas = useRef(canvas);
  latestCanvas.current = canvas;
  const state = getCanvasNodeEditorState(node);
  const isRoot = node.id === canvas.root.id;
  useEffect(() => { setWeight((current) => resolveCanvasWeightMethod(current, state)); }, [state.canUseMarketCap, state.hasPreviewableCompanies]);
  useEffect(() => { setNameDraft(node.name); setDescriptionDraft(node.description ?? ''); }, [node.id, node.name, node.description]);
  useEffect(() => { const guard = createLatestAsyncGuard(); searchGuard.current = guard; setQuery(''); setSuggestions([]); return () => guard.dispose(); }, [node.id]);
  const createNode = (kind: 'child' | 'sibling') => {
    const id = crypto.randomUUID();
    const next = kind === 'child' ? addCanvasChild(canvas, node.id, { id, name: '新细分环节' }) : addCanvasSibling(canvas, node.id, { id, name: '新细分环节' });
    onChange(next); onSelect?.(id);
  };
  const search = async (value: string) => {
    setQuery(value); setAddingCode(''); const guard = searchGuard.current; const token = guard.next();
    if (!value.trim()) { setSuggestions([]); return; }
    const result = await searchSecuritySuggestions(value).catch(() => []);
    if (guard.isCurrent(token)) setSuggestions(result);
  };
  const hydrateStock = async (stock: SecuritySuggestion | CanvasStock, isNew: boolean) => {
    const guard = searchGuard.current; const token = guard.next(); setAddingCode(stock.code); setAddError('');
    let metrics = { change: null as number | null, marketCap: null as number | null, pe: null as number | null };
    let error = '';
    try { const quote = await fetchSecurityMetrics(stock.code); metrics = { change: quote.change, marketCap: quote.marketCap, pe: quote.pe }; } catch { error = '行情指标暂时不可用，股票已保留，可点击“刷新指标”重试。'; }
    if (!guard.isCurrent(token)) return;
    setAddError(error);
    const base = latestCanvas.current;
    const nextStock = { ...stock, ...metrics };
    const next = isNew ? addStockToCanvasNode(base, node.id, nextStock) : updateCanvasStock(base, node.id, nextStock);
    latestCanvas.current = next;
    onChange(next); setQuery(''); setSuggestions([]); setAddingCode('');
  };
  return <form className="industry-canvas-node-editor" onSubmit={(event) => event.preventDefault()} onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <div className="industry-canvas-node-editor__head"><nav aria-label="当前节点完整路径">{path.map((item, index) => <button type="button" key={item.id} onClick={() => onSelect?.(item.id)}>{index ? ' / ' : ''}{item.name}</button>)}</nav><button type="button" aria-label="收起编辑器" onClick={onClose}><X size={15} /></button></div>
    <label>环节名称<input data-canvas-node-name autoFocus={focusName} value={nameDraft} onChange={(event) => setNameDraft(event.target.value)} onBlur={() => onChange(renameCanvasNode(canvas, node.id, nameDraft))} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); onChange(renameCanvasNode(canvas, node.id, nameDraft)); event.currentTarget.blur(); } }} /></label>
    <label>说明<textarea value={descriptionDraft} onChange={(event) => setDescriptionDraft(event.target.value)} onBlur={() => onChange(updateCanvasNodeDescription(canvas, node.id, descriptionDraft))} /></label>
    <div className="industry-canvas-company-counts">直接标的 {state.directCompanyCount} / 分支公司 {state.branchCompanyCount}</div>
    <div className="industry-canvas-metrics"><span>平均涨幅 <b>{state.metrics.averageChange === null ? '—' : `${state.metrics.averageChange.toFixed(2)}%`}</b></span><span>平均 PE <b>{state.metrics.averagePe === null ? '—' : state.metrics.averagePe.toFixed(2)} <small>{state.peIncludedCount}/{state.peTotalCount}</small></b></span><span>平均市值 <b>{state.metrics.averageMarketCap === null ? '—' : state.metrics.averageMarketCap.toFixed(0)}</b></span></div>
    <div className="industry-canvas-search"><Search size={15} /><input value={query} onChange={(event) => void search(event.target.value)} placeholder="搜索股票并一键加入" />{suggestions.map((item) => <button type="button" disabled={Boolean(addingCode)} key={item.code} onClick={() => void hydrateStock(item, true)}>{item.name}<small>{addingCode === item.code ? '读取行情…' : item.code}</small><Plus size={13} /></button>)}{addError ? <small role="status">{addError}</small> : null}</div>
    <div className="industry-canvas-stocks">{node.stocks.map((stock) => { const missingMetrics = stock.change === null && stock.marketCap === null && stock.pe === null; return <span key={stock.code}><button type="button" onClick={() => onStock?.(stock.code, stock.name)}>{stock.name}<small>{stock.code}</small></button>{missingMetrics ? <button type="button" disabled={Boolean(addingCode)} onClick={() => void hydrateStock(stock, false)}>{addingCode === stock.code ? '刷新中…' : '刷新指标'}</button> : null}<button type="button" aria-label={`删除 ${stock.name}`} onClick={() => onChange(removeStockFromCanvasNode(latestCanvas.current, node.id, stock.code))}><X size={12} /></button></span>; })}</div>
    <div className="industry-canvas-node-editor__actions"><button type="button" onClick={() => createNode('child')}><Plus size={14} />添加子节点</button><button type="button" disabled={isRoot} onClick={() => createNode('sibling')}>添加同级</button><button type="button" disabled={isRoot} onClick={() => { onChange(removeCanvasNode(canvas, node.id)); onSelect?.(path.at(-2)?.id ?? canvas.root.id); }}><Trash2 size={14} />删除当前</button></div>
    <div className="industry-canvas-preview"><div><button type="button" disabled={!state.hasPreviewableCompanies} className={weight === 'equal' ? 'is-active' : ''} onClick={() => setWeight('equal')}>等权</button><button type="button" disabled={!state.canUseMarketCap} className={weight === 'marketCap' ? 'is-active' : ''} onClick={() => setWeight('marketCap')}>市值加权</button></div><small>{!state.hasPreviewableCompanies ? '当前分支暂无可计算公司' : weight === 'marketCap' ? `纳入计算 ${state.marketCapIncludedCount} / 分支公司 ${state.marketCapTotalCount}` : `纳入计算 ${state.previewableCompanyCount} / 分支公司 ${state.branchCompanyCount}`}</small><button type="button" disabled={!state.hasPreviewableCompanies || (weight === 'marketCap' && !state.canUseMarketCap)} onClick={() => { const method = resolveCanvasWeightMethod(weight, state); if (state.hasPreviewableCompanies && (method !== 'marketCap' || state.canUseMarketCap)) onBranch?.(node, method, path); }}>用本分支生成指数 K 线</button></div>
  </form>;
}
