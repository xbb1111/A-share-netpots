import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Maximize2, Minus, Plus } from 'lucide-react';
import { addCanvasChild, addCanvasSibling, type CanvasNode, type IndustryCanvas } from '../data/industryCanvas';
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
  if (isFormControl || key !== 'Insert') return null;
  return shiftKey ? 'sibling' : 'child';
}

export const clampCanvasZoom = (value: number) => Math.max(.55, Math.min(1.5, Number.isFinite(value) ? value : 1));
export function calculateFitTransform(viewportWidth: number, viewportHeight: number, layoutWidth: number, layoutHeight: number, padding = 24) {
  const availableWidth = Math.max(1, viewportWidth - padding * 2);
  const availableHeight = Math.max(1, viewportHeight - padding * 2);
  const scale = Math.max(.1, Math.min(1.5, Math.min(availableWidth / Math.max(1, layoutWidth), availableHeight / Math.max(1, layoutHeight))));
  return { scale, x: (viewportWidth - layoutWidth * scale) / 2, y: (viewportHeight - layoutHeight * scale) / 2 };
}
export type CanvasDragState = { pointerId: number; x: number; y: number; px: number; py: number };
export const createCanvasDragState = (pointerId: number, x: number, y: number, px: number, py: number): CanvasDragState => ({ pointerId, x, y, px, py });
export const endCanvasDrag = (state: CanvasDragState | null, pointerId: number) => state?.pointerId === pointerId ? null : state;

function buildCanvasIndex(root: CanvasNode) {
  const nodes = new Map<string, CanvasNode>(); const paths = new Map<string, CanvasNode[]>(); const navigation = new Map<string, Record<string, string | null>>();
  const stack: Array<{ node: CanvasNode; path: CanvasNode[] }> = [{ node: root, path: [] }];
  while (stack.length) { const { node, path } = stack.pop()!; const nextPath = [...path, node]; nodes.set(node.id, node); paths.set(node.id, nextPath); for (let i = node.children.length - 1; i >= 0; i -= 1) stack.push({ node: node.children[i], path: nextPath }); }
  for (const [id, path] of paths) { const node = nodes.get(id)!; const parent = path.at(-2); const siblings = parent?.children ?? []; const position = siblings.findIndex((item) => item.id === id); navigation.set(id, { ArrowLeft: parent?.id ?? null, ArrowRight: node.children[0]?.id ?? null, ArrowUp: siblings[position - 1]?.id ?? null, ArrowDown: siblings[position + 1]?.id ?? null }); }
  return { nodes, paths, navigation };
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
  const drag = useRef<CanvasDragState | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const focusFrame = useRef<number | null>(null);
  const [pendingFocusId, setPendingFocusId] = useState<string | null>(null);
  useEffect(() => () => { drag.current = null; if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current); }, []);
  const layout = useMemo(() => layoutCanvasMindMap(canvas.root, selectedId, {
    expandedId: expandedId ?? undefined,
    expandedWidth: 380,
    expandedHeight: 520,
  }), [canvas.root, selectedId, expandedId]);
  const index = useMemo(() => buildCanvasIndex(canvas.root), [canvas.root]);
  const focus = (id: string) => {
    onSelect(id);
    if (focusFrame.current !== null) cancelAnimationFrame(focusFrame.current);
    focusFrame.current = requestAnimationFrame(() => { viewportRef.current?.querySelector<HTMLElement>(`[data-canvas-node="${CSS.escape(id)}"]`)?.focus(); focusFrame.current = null; });
  };
  const changeZoom = (next: number) => setZoom(clampCanvasZoom(next));
  const finishDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    drag.current = endCanvasDrag(drag.current, event.pointerId);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  useEffect(() => {
    if (!pendingFocusId || expandedId !== pendingFocusId) return;
    const frame = requestAnimationFrame(() => { if (expandedId === pendingFocusId && selectedId === pendingFocusId) viewportRef.current?.querySelector<HTMLElement>(`[data-canvas-editor="${CSS.escape(pendingFocusId)}"] [data-canvas-node-name]`)?.focus(); });
    setPendingFocusId(null);
    return () => cancelAnimationFrame(frame);
  }, [expandedId, pendingFocusId, selectedId]);
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
        drag.current = createCanvasDragState(event.pointerId, event.clientX, event.clientY, pan.x, pan.y);
      }}
      onPointerMove={(event) => { if (drag.current?.pointerId === event.pointerId) setPan({ x: drag.current.px + event.clientX - drag.current.x, y: drag.current.py + event.clientY - drag.current.y }); }}
      onPointerUp={finishDrag}
      onPointerCancel={finishDrag}
      onLostPointerCapture={finishDrag}>
      <div data-canvas-pan-surface className="industry-mind-map__surface" role="tree" aria-label="自定义产业链节点" style={{ width: layout.width, height: layout.height, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}>
        <svg className="industry-mind-map__links" width={layout.width} height={layout.height} aria-hidden="true">
          {layout.links.map((link) => <path key={link.id} className={link.isOnSelectedPath ? 'is-path' : ''} d={`M ${link.from.x} ${link.from.y} C ${link.from.x + 30} ${link.from.y}, ${link.to.x - 30} ${link.to.y}, ${link.to.x} ${link.to.y}`} />)}
        </svg>
        {layout.nodes.map((item) => {
          const source = index.nodes.get(item.id)!;
          const active = expandedId === item.id;
          const editorId = `canvas-editor-${item.id}`;
          return <div key={item.id} className={`industry-mind-map__html-node ${active ? 'is-expanded' : ''}`} style={{ left: item.x, top: item.y, width: item.width, height: item.height }} onKeyDown={active ? (event) => {
            if ((event.target as HTMLElement).closest('form')) return;
            if (event.key === 'Escape') {
              event.preventDefault(); onExpand(null); focus(item.id);
            }
          } : undefined}>
            {active ? <><button type="button" data-canvas-node={item.id} role="treeitem" aria-selected="true" aria-controls={editorId} tabIndex={0} className="industry-mind-map__node industry-mind-map__node--expanded"><strong>{item.name}</strong></button><div id={editorId} data-canvas-editor={item.id} role="group" aria-label={`编辑 ${item.name}`}><IndustryCanvasNodeEditor canvas={canvas} node={source} path={index.paths.get(item.id)!} focusName={pendingFocusId === item.id} onChange={onChange} onClose={() => { onExpand(null); focus(item.id); }} onSelect={(id) => expandAndFocus(id, true)} onStock={onStock} onBranch={onBranch} /></div></> :
              <button type="button" data-canvas-node={item.id} role="treeitem" tabIndex={item.id === selectedId ? 0 : -1} aria-selected={item.id === selectedId} className={`industry-mind-map__node ${item.id === selectedId ? 'is-selected' : ''} ${item.isOnSelectedPath ? 'is-path' : ''}`} onClick={() => expandAndFocus(item.id)} onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); expandAndFocus(item.id); return; }
                const action = getCanvasKeyboardAction(event.key, event.shiftKey, false);
                if (action) { event.preventDefault(); createFromKeyboard(item.id, action); return; }
                const next = index.navigation.get(item.id)?.[event.key] ?? null;
                if (next) { event.preventDefault(); focus(next); }
              }}><strong>{item.name}</strong><small>{item.stockCount} 家直接标的 · L{item.depth + 1}</small></button>}
          </div>;
        })}
      </div>
    </div>
  </div>;
}
