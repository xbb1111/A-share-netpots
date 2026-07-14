import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { addCanvasChild, addCanvasSibling, findCanvasNode, type CanvasNode, type IndustryCanvas } from '../data/industryCanvas';
import { getCanvasNodePath, layoutCanvasMindMap } from '../data/canvasMindMap';
import { IndustryCanvasNodeEditor } from './IndustryCanvasNodeEditor';

export function getCanvasKeyboardTarget(root: CanvasNode, id: string, key: string): string | null {
  const path = getCanvasNodePath(root, id);
  const node = path.at(-1);
  if (!node || node.id !== id) return null;
  if (key === 'ArrowLeft') return path.at(-2)?.id ?? null;
  if (key === 'ArrowRight') return node.children[0]?.id ?? null;
  const parent = path.at(-2);
  if (!parent) return null;
  const index = parent.children.findIndex((child) => child.id === id);
  if (key === 'ArrowUp') return parent.children[index - 1]?.id ?? null;
  if (key === 'ArrowDown') return parent.children[index + 1]?.id ?? null;
  return null;
}

export function getCanvasKeyboardAction(key: string, shiftKey: boolean, isFormControl: boolean): 'child' | 'sibling' | null {
  if (isFormControl || key !== 'Tab') return null;
  return shiftKey ? 'sibling' : 'child';
}

export const clampCanvasZoom = (value: number) => Math.max(.55, Math.min(1.5, Number.isFinite(value) ? value : 1));
export function calculateFitTransform(viewportWidth: number, viewportHeight: number, layoutWidth: number, layoutHeight: number, padding = 24) {
  const availableWidth = Math.max(1, viewportWidth - padding * 2);
  const availableHeight = Math.max(1, viewportHeight - padding * 2);
  const scale = clampCanvasZoom(Math.min(availableWidth / Math.max(1, layoutWidth), availableHeight / Math.max(1, layoutHeight)));
  return { scale, x: (viewportWidth - layoutWidth * scale) / 2, y: (viewportHeight - layoutHeight * scale) / 2 };
}
type ClosestTarget = { closest: (selector: string) => unknown };
export function shouldStartCanvasPan(target: ClosestTarget | null): boolean {
  if (!target || target.closest('button,input,textarea,select,form,[role="treeitem"],.industry-canvas-node-editor')) return false;
  return Boolean(target.closest('[data-canvas-pan-surface]'));
}

type Props = {
  canvas: IndustryCanvas;
  selectedId: string;
  expandedId: string | null;
  onSelect: (id: string) => void;
  onExpand: (id: string | null) => void;
  onChange: (canvas: IndustryCanvas) => void;
  onStock?: (code: string, name: string) => void;
  onBranch?: (node: CanvasNode, method: 'equal' | 'marketCap', path: CanvasNode[]) => void;
};

export function IndustryCanvasMindMap({ canvas, selectedId, expandedId, onSelect, onExpand, onChange, onStock, onBranch }: Props) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  const layout = useMemo(() => layoutCanvasMindMap(canvas.root, selectedId, {
    expandedId: expandedId ?? undefined,
    expandedWidth: 380,
    expandedHeight: 520,
  }), [canvas.root, selectedId, expandedId]);
  const focus = (id: string) => {
    onSelect(id);
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-canvas-node="${CSS.escape(id)}"]`)?.focus());
  };
  const changeZoom = (next: number) => setZoom(clampCanvasZoom(next));
  useEffect(() => {
    if (!pendingFocusId || expandedId !== pendingFocusId) return;
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-canvas-active-node="${CSS.escape(pendingFocusId)}"] [data-canvas-node-name]`)?.focus());
    setPendingFocusId(null);
  }, [expandedId, pendingFocusId]);
  const expandAndFocus = (id: string, focusName = true) => { onSelect(id); onExpand(id); if (focusName) setPendingFocusId(id); };
  const createFromKeyboard = (nodeId: string, kind: 'child' | 'sibling') => {
    if (kind === 'sibling' && nodeId === canvas.root.id) return;
    const id = crypto.randomUUID();
    const next = kind === 'child'
      ? addCanvasChild(canvas, nodeId, { id, name: '新细分环节' })
      : addCanvasSibling(canvas, nodeId, { id, name: '新细分环节' });
    onChange(next);
    expandAndFocus(id, true);
  };

  return <div className="industry-mind-map">
    <div className="industry-mind-map__controls">
      <button type="button" aria-label="缩小" onClick={() => changeZoom(zoom - .1)}><Minus size={14} /></button>
      <span>{Math.round(zoom * 100)}%</span>
      <button type="button" aria-label="放大" onClick={() => changeZoom(zoom + .1)}><Plus size={14} /></button>
      <button type="button" onClick={() => { const element = viewportRef.current; if (!element) return; const fit = calculateFitTransform(element.clientWidth, element.clientHeight, layout.width, layout.height); setZoom(fit.scale); setPan({ x: fit.x, y: fit.y }); }}><Maximize2 size={14} />适应画布</button>
    </div>
    <div ref={viewportRef} data-canvas-pan-surface className="industry-mind-map__viewport"
      onPointerDown={(event) => {
        if (!shouldStartCanvasPan(event.target as HTMLElement)) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        drag.current = { x: event.clientX, y: event.clientY, px: pan.x, py: pan.y };
      }}
      onPointerMove={(event) => { if (drag.current) setPan({ x: drag.current.px + event.clientX - drag.current.x, y: drag.current.py + event.clientY - drag.current.y }); }}
      onPointerUp={() => { drag.current = null; }}>
      <div data-canvas-pan-surface className="industry-mind-map__surface" role="tree" aria-label="自定义产业链节点" style={{ width: layout.width, height: layout.height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <svg className="industry-mind-map__links" width={layout.width} height={layout.height} aria-hidden="true">
          {layout.links.map((link) => <path key={link.id} className={link.isOnSelectedPath ? 'is-path' : ''} d={`M ${link.from.x} ${link.from.y} C ${link.from.x + 30} ${link.from.y}, ${link.to.x - 30} ${link.to.y}, ${link.to.x} ${link.to.y}`} />)}
        </svg>
        {layout.nodes.map((item) => {
          const source = findCanvasNode(canvas.root, item.id)!;
          const active = expandedId === item.id;
          return <div key={item.id} data-canvas-active-node={active ? item.id : undefined} role={active ? 'treeitem' : undefined} aria-selected={active ? true : undefined} tabIndex={active ? 0 : undefined} className={`industry-mind-map__html-node ${active ? 'is-expanded' : ''}`} style={{ left: item.x, top: item.y, width: item.width, height: item.height }} onKeyDown={active ? (event) => {
            if (event.key === 'Escape' && !(event.target as HTMLElement).matches('input,textarea,select')) {
              event.preventDefault(); onExpand(null); focus(item.id);
            }
          } : undefined}>
            {active ? <IndustryCanvasNodeEditor canvas={canvas} node={source} path={getCanvasNodePath(canvas.root, item.id)} focusName={pendingFocusId === item.id} onChange={onChange} onClose={() => { onExpand(null); focus(item.id); }} onSelect={(id) => expandAndFocus(id, true)} onStock={onStock} onBranch={onBranch} /> :
              <button type="button" data-canvas-node={item.id} role="treeitem" aria-selected={item.id === selectedId} className={`industry-mind-map__node ${item.id === selectedId ? 'is-selected' : ''} ${item.isOnSelectedPath ? 'is-path' : ''}`} onClick={() => expandAndFocus(item.id)} onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); expandAndFocus(item.id); return; }
                const action = getCanvasKeyboardAction(event.key, event.shiftKey, false);
                if (action) { event.preventDefault(); createFromKeyboard(item.id, action); return; }
                const next = getCanvasKeyboardTarget(canvas.root, item.id, event.key);
                if (next) { event.preventDefault(); focus(next); }
              }}><strong>{item.name}</strong><small>{item.stockCount} 家直接标的 · L{item.depth + 1}</small></button>}
          </div>;
        })}
      </div>
    </div>
  </div>;
}
