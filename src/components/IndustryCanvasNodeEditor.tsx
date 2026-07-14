import { useState } from 'react';
import { Plus, Search, Trash2, X } from 'lucide-react';
import { addCanvasChild, addCanvasSibling, addStockToCanvasNode, collectBranchStocks, getBranchMetrics, removeCanvasNode, removeStockFromCanvasNode, renameCanvasNode, updateCanvasNodeDescription, type CanvasNode, type IndustryCanvas } from '../data/industryCanvas';
import { getComputableBranchStocks } from '../data/industryIndexPreview';
import { searchSecuritySuggestions, type SecuritySuggestion } from '../data/priceDiscipline';

export function getCanvasNodeEditorState(node: CanvasNode) {
  const branchStocks = collectBranchStocks(node);
  const metrics = getBranchMetrics(node);
  const previewable = getComputableBranchStocks(node);
  return {
    directCompanyCount: node.stocks.length,
    branchCompanyCount: branchStocks.length,
    metrics,
    peIncludedCount: metrics.peCompanyCount,
    peTotalCount: metrics.companyCount,
    canUseMarketCap: branchStocks.length > 0 && branchStocks.every((stock) => typeof stock.marketCap === 'number' && Number.isFinite(stock.marketCap) && stock.marketCap > 0),
    hasPreviewableCompanies: previewable.length > 0,
  };
}

type Props = { canvas: IndustryCanvas; node: CanvasNode; path: CanvasNode[]; onChange: (canvas: IndustryCanvas) => void; onClose: () => void; onSelect?: (id: string) => void; onStock?: (code: string, name: string) => void; onBranch?: (node: CanvasNode, method: 'equal' | 'marketCap', path: CanvasNode[]) => void; focusName?: boolean };

export function IndustryCanvasNodeEditor({ canvas, node, path, onChange, onClose, onSelect, onStock, onBranch, focusName }: Props) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SecuritySuggestion[]>([]);
  const [weight, setWeight] = useState<'equal' | 'marketCap'>('equal');
  const state = getCanvasNodeEditorState(node);
  const isRoot = node.id === canvas.root.id;
  const createNode = (kind: 'child' | 'sibling') => { const id = crypto.randomUUID(); const next = kind === 'child' ? addCanvasChild(canvas, node.id, { id, name: '新细分环节' }) : addCanvasSibling(canvas, node.id, { id, name: '新细分环节' }); onChange(next); onSelect?.(id); };
  const search = async (value: string) => { setQuery(value); setSuggestions(value.trim() ? await searchSecuritySuggestions(value).catch(() => []) : []); };
  const add = (stock: SecuritySuggestion) => { onChange(addStockToCanvasNode(canvas, node.id, { ...stock, change: null, marketCap: null, pe: null })); setQuery(''); setSuggestions([]); };
  return <form className="industry-canvas-node-editor" onSubmit={(event) => event.preventDefault()} onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <div className="industry-canvas-node-editor__head"><nav aria-label="当前节点完整路径">{path.map((item, index) => <button type="button" key={item.id} onClick={() => onSelect?.(item.id)}>{index ? ' / ' : ''}{item.name}</button>)}</nav><button type="button" aria-label="收起编辑器" onClick={onClose}><X size={15} /></button></div>
    <label>环节名称<input autoFocus={focusName} value={node.name} onChange={(event) => onChange(renameCanvasNode(canvas, node.id, event.target.value))} /></label>
    <label>说明<textarea value={node.description ?? ''} onChange={(event) => onChange(updateCanvasNodeDescription(canvas, node.id, event.target.value))} /></label>
    <div className="industry-canvas-metrics"><span>平均涨幅 <b>{state.metrics.averageChange === null ? '—' : `${state.metrics.averageChange.toFixed(2)}%`}</b></span><span>平均 PE <b>{state.metrics.averagePe === null ? '—' : state.metrics.averagePe.toFixed(2)} <small>{state.peIncludedCount}/{state.peTotalCount}</small></b></span><span>平均市值 <b>{state.metrics.averageMarketCap === null ? '—' : state.metrics.averageMarketCap.toFixed(0)}</b></span></div>
    <div className="industry-canvas-search"><Search size={15} /><input value={query} onChange={(event) => void search(event.target.value)} placeholder="搜索股票并一键加入" />{suggestions.map((item) => <button type="button" key={item.code} onClick={() => add(item)}>{item.name}<small>{item.code}</small><Plus size={13} /></button>)}</div>
    <div className="industry-canvas-stocks">{node.stocks.map((stock) => <span key={stock.code}><button type="button" onClick={() => onStock?.(stock.code, stock.name)}>{stock.name}<small>{stock.code}</small></button><button type="button" aria-label={`删除 ${stock.name}`} onClick={() => onChange(removeStockFromCanvasNode(canvas, node.id, stock.code))}><X size={12} /></button></span>)}</div>
    <div className="industry-canvas-node-editor__actions"><button type="button" onClick={() => createNode('child')}><Plus size={14} />添加子节点</button><button type="button" disabled={isRoot} onClick={() => createNode('sibling')}>添加同级</button><button type="button" disabled={isRoot} onClick={() => { onChange(removeCanvasNode(canvas, node.id)); onSelect?.(path.at(-2)?.id ?? canvas.root.id); }}><Trash2 size={14} />删除当前</button></div>
    <div className="industry-canvas-preview"><div><button type="button" className={weight === 'equal' ? 'is-active' : ''} onClick={() => setWeight('equal')}>等权</button><button type="button" disabled={!state.canUseMarketCap} className={weight === 'marketCap' ? 'is-active' : ''} onClick={() => setWeight('marketCap')}>市值加权</button></div><small>{!state.hasPreviewableCompanies ? '当前分支暂无可计算公司' : !state.canUseMarketCap ? '部分公司缺少有效市值，只能使用等权。' : `分支共 ${state.branchCompanyCount} 家公司`}</small><button type="button" disabled={!state.hasPreviewableCompanies} onClick={() => onBranch?.(node, weight, path)}>用本分支生成指数 K 线</button></div>
  </form>;
}
