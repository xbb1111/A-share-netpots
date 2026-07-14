import type { CanvasNode } from './industryCanvas';

export type MindMapNode = { id: string; name: string; depth: number; x: number; y: number; width: number; height: number; stockCount: number; isOnSelectedPath: boolean };
export type MindMapLink = { id: string; parentId: string; childId: string; from: { x: number; y: number }; to: { x: number; y: number }; isOnSelectedPath: boolean };
export type MindMapLayout = { nodes: MindMapNode[]; links: MindMapLink[]; width: number; height: number };

const NODE_WIDTH = 172;
const NODE_HEIGHT = 62;
const COLUMN_GAP = 76;
const ROW_GAP = 18;
const PADDING = 28;

function selectedPath(root: CanvasNode, selectedId: string) {
  const visit = (node: CanvasNode, path: string[]): string[] | null => {
    const next = [...path, node.id];
    if (node.id === selectedId) return next;
    for (const child of node.children) { const result = visit(child, next); if (result) return result; }
    return null;
  };
  return new Set(visit(root, []) ?? [root.id]);
}

export function layoutCanvasMindMap(root: CanvasNode, selectedId = root.id): MindMapLayout {
  const path = selectedPath(root, selectedId);
  const nodes: MindMapNode[] = [];
  const links: MindMapLink[] = [];
  let row = 0;
  const place = (node: CanvasNode, depth: number) => {
    const childNodes = node.children.map((child) => place(child, depth + 1));
    const y = childNodes.length ? (childNodes[0].y + childNodes[childNodes.length - 1].y) / 2 : PADDING + row++ * (NODE_HEIGHT + ROW_GAP);
    const placed: MindMapNode = { id: node.id, name: node.name, depth, x: PADDING + depth * (NODE_WIDTH + COLUMN_GAP), y, width: NODE_WIDTH, height: NODE_HEIGHT, stockCount: node.stocks.length, isOnSelectedPath: path.has(node.id) };
    nodes.push(placed);
    childNodes.forEach((child) => links.push({ id: `${placed.id}:${child.id}`, parentId: placed.id, childId: child.id, from: { x: placed.x + placed.width, y: placed.y + placed.height / 2 }, to: { x: child.x, y: child.y + child.height / 2 }, isOnSelectedPath: placed.isOnSelectedPath && child.isOnSelectedPath }));
    return placed;
  };
  place(root, 0);
  const maxDepth = Math.max(...nodes.map((node) => node.depth));
  return { nodes, links, width: PADDING * 2 + (maxDepth + 1) * NODE_WIDTH + maxDepth * COLUMN_GAP, height: PADDING * 2 + Math.max(1, row) * NODE_HEIGHT + Math.max(0, row - 1) * ROW_GAP };
}
