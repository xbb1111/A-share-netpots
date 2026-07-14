import { useEffect, useMemo, useState } from 'react';
import { Link, Save } from 'lucide-react';
import { createCanvasSharePayload, parseCanvasSharePayload, type CanvasNode, type IndustryCanvas } from '../data/industryCanvas';
import { getCanvasNodePath } from '../data/canvasMindMap';
import { getComputableBranchStocks } from '../data/industryIndexPreview';
import { IndustryCanvasMindMap } from './IndustryCanvasMindMap';

export function getCanvasBranchPreviewState(node: CanvasNode, path: CanvasNode[]) {
  const companyCount = getComputableBranchStocks(node).length;
  return { disabled: companyCount === 0, companyCount, pathNames: path.map((item) => item.name), message: companyCount === 0 ? '当前分支暂无可计算公司' : '' };
}

type Props = {
  canvas: IndustryCanvas;
  onChange: (canvas: IndustryCanvas) => void;
  onSave: (canvas: IndustryCanvas) => void;
  onStock?: (code: string, name: string) => void;
  onBranch?: (node: CanvasNode, method: 'equal' | 'marketCap', path: CanvasNode[]) => void;
};

export function IndustryCanvasEditor({ canvas, onChange, onSave, onStock, onBranch }: Props) {
  const [selectedId, setSelectedId] = useState(canvas.root.id);
  const [expandedId, setExpandedId] = useState<string | null>(canvas.root.id);
  const [shareInput, setShareInput] = useState('');
  useEffect(() => {
    if (!getCanvasNodePath(canvas.root, selectedId).some((node) => node.id === selectedId)) {
      setSelectedId(canvas.root.id);
      setExpandedId(canvas.root.id);
    }
  }, [canvas.root, selectedId]);
  const share = useMemo(() => createCanvasSharePayload(canvas, typeof window === 'undefined' ? 'http://localhost/' : window.location.href), [canvas]);
  const importShare = () => {
    const imported = parseCanvasSharePayload(shareInput);
    if (!imported) return;
    onChange(imported);
    setSelectedId(imported.root.id);
    setExpandedId(imported.root.id);
    setShareInput('');
  };
  return <section className="industry-canvas-editor">
    <header><div><span>我的产业链</span><h3>{canvas.name}</h3><small>在画布节点内直接编辑；方向键导航，Tab 新建下级，Shift+Tab 新建同级。</small></div><div>
      <button type="button" onClick={() => navigator.clipboard?.writeText(share.value)}><Link size={15} />分享</button>
      <button type="button" onClick={() => onSave(canvas)}><Save size={15} />保存</button>
    </div></header>
    <div className="industry-canvas-map-panel">
      <div className="industry-canvas-map-panel__toolbar"><span>点击或 Enter 展开节点，Escape 收起</span><div className="industry-canvas-import"><input aria-label="分享链接或 JSON" value={shareInput} onChange={(event) => setShareInput(event.target.value)} placeholder="粘贴分享链接或 JSON" /><button type="button" onClick={importShare}>加载链接</button></div></div>
      <IndustryCanvasMindMap canvas={canvas} selectedId={selectedId} expandedId={expandedId} onSelect={setSelectedId} onExpand={setExpandedId} onChange={onChange} onStock={onStock} onBranch={onBranch} />
    </div>
  </section>;
}
