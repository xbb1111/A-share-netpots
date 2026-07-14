import { useMemo } from 'react';
import { Network } from 'lucide-react';
import type { CanvasNode } from '../data/industryCanvas';
import { layoutCanvasMindMap } from '../data/canvasMindMap';

export function IndustryCanvasMindMap({ root, selectedId, onSelect }: { root: CanvasNode; selectedId: string; onSelect: (id: string) => void }) {
  const layout = useMemo(() => layoutCanvasMindMap(root, selectedId), [root, selectedId]);
  return <div className="industry-mind-map" aria-label="产业链思维导图">
    <div className="industry-mind-map__hint"><Network size={15} /> 点击节点编辑；当前路径高亮</div>
    <svg viewBox={`0 0 ${layout.width} ${layout.height}`} role="tree" aria-label="自定义产业链节点">
      {layout.links.map((link) => <path key={link.id} className={link.isOnSelectedPath ? 'is-path' : ''} d={`M ${link.from.x} ${link.from.y} C ${link.from.x + 30} ${link.from.y}, ${link.to.x - 30} ${link.to.y}, ${link.to.x} ${link.to.y}`} />)}
      {layout.nodes.map((node) => <g key={node.id} className={`industry-mind-map__node ${node.id === selectedId ? 'is-selected' : ''} ${node.isOnSelectedPath ? 'is-path' : ''}`} transform={`translate(${node.x} ${node.y})`} role="treeitem" tabIndex={0} aria-selected={node.id === selectedId} onClick={() => onSelect(node.id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onSelect(node.id); } }}>
        <rect width={node.width} height={node.height} rx="10" />
        <text className="industry-mind-map__node-name" x="14" y="27">{node.name}</text>
        <text className="industry-mind-map__node-meta" x="14" y="46">{node.stockCount} 家直接标的 · L{node.depth + 1}</text>
      </g>)}
    </svg>
  </div>;
}
