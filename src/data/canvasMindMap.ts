import type { CanvasNode } from './industryCanvas';

export type MindMapNode = { id: string; name: string; depth: number; x: number; y: number; width: number; height: number; stockCount: number; isOnSelectedPath: boolean };
export type MindMapLink = { id: string; parentId: string; childId: string; from: { x: number; y: number }; to: { x: number; y: number }; isOnSelectedPath: boolean };
export type MindMapLayout = { nodes: MindMapNode[]; links: MindMapLink[]; width: number; height: number };
export type MindMapLayoutOptions = { expandedId?: string; expandedWidth?: number; expandedHeight?: number };
export type MindMapRectangle = { x: number; y: number; width: number; height: number };

const NODE_WIDTH = 172;
const NODE_HEIGHT = 62;
const COLUMN_GAP = 76;
const ROW_GAP = 18;
const PADDING = 28;

export function getCanvasNodePath(root: CanvasNode, selectedId: string): CanvasNode[] {
  const visit = (node: CanvasNode, path: string[]): string[] | null => {
    const next = [...path, node.id];
    if (node.id === selectedId) return next;
    for (const child of node.children) { const result = visit(child, next); if (result) return result; }
    return null;
  };
  const ids = visit(root, []) ?? [root.id];
  const index = new Map<string, CanvasNode>();
  const collect = (node: CanvasNode) => { index.set(node.id, node); node.children.forEach(collect); };
  collect(root);
  return ids.map((id) => index.get(id)!).filter(Boolean);
}

export function rectanglesOverlap(a: MindMapRectangle, b: MindMapRectangle): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x
    && a.y < b.y + b.height && a.y + a.height > b.y;
}

type LayoutTree = {
  source: CanvasNode;
  depth: number;
  width: number;
  height: number;
  subtreeHeight: number;
  children: LayoutTree[];
};

const expandedDimension = (value: number | undefined, minimum: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(minimum, value) : minimum;

export function layoutCanvasMindMap(root: CanvasNode, selectedId = root.id, options: MindMapLayoutOptions = {}): MindMapLayout {
  const path = new Set(getCanvasNodePath(root, selectedId).map((node) => node.id));
  const nodes: MindMapNode[] = [];
  const links: MindMapLink[] = [];

  const measure = (node: CanvasNode, depth: number): LayoutTree => {
    const expanded = node.id === options.expandedId;
    const width = expanded ? expandedDimension(options.expandedWidth, NODE_WIDTH) : NODE_WIDTH;
    const height = expanded ? expandedDimension(options.expandedHeight, NODE_HEIGHT) : NODE_HEIGHT;
    const children = node.children.map((child) => measure(child, depth + 1));
    const childrenHeight = children.reduce((sum, child) => sum + child.subtreeHeight, 0)
      + Math.max(0, children.length - 1) * ROW_GAP;
    return { source: node, depth, width, height, children, subtreeHeight: Math.max(height, childrenHeight) };
  };

  const tree = measure(root, 0);
  const columnWidths: number[] = [];
  const collectWidths = (item: LayoutTree) => {
    columnWidths[item.depth] = Math.max(columnWidths[item.depth] ?? 0, item.width);
    item.children.forEach(collectWidths);
  };
  collectWidths(tree);
  const columnX: number[] = [];
  columnWidths.forEach((_, depth) => {
    columnX[depth] = depth === 0 ? PADDING : columnX[depth - 1] + columnWidths[depth - 1] + COLUMN_GAP;
  });

  const placedById = new Map<string, MindMapNode>();
  const place = (item: LayoutTree, top: number) => {
    const placed: MindMapNode = {
      id: item.source.id,
      name: item.source.name,
      depth: item.depth,
      x: columnX[item.depth],
      y: top + (item.subtreeHeight - item.height) / 2,
      width: item.width,
      height: item.height,
      stockCount: item.source.stocks.length,
      isOnSelectedPath: path.has(item.source.id),
    };
    nodes.push(placed);
    placedById.set(placed.id, placed);
    const childrenHeight = item.children.reduce((sum, child) => sum + child.subtreeHeight, 0)
      + Math.max(0, item.children.length - 1) * ROW_GAP;
    let childTop = top + (item.subtreeHeight - childrenHeight) / 2;
    item.children.forEach((child) => {
      place(child, childTop);
      childTop += child.subtreeHeight + ROW_GAP;
    });
  };
  place(tree, PADDING);

  const connect = (item: LayoutTree) => {
    const parent = placedById.get(item.source.id)!;
    item.children.forEach((childTree) => {
      const child = placedById.get(childTree.source.id)!;
      links.push({
        id: `${parent.id}:${child.id}`,
        parentId: parent.id,
        childId: child.id,
        from: { x: parent.x + parent.width, y: parent.y + parent.height / 2 },
        to: { x: child.x, y: child.y + child.height / 2 },
        isOnSelectedPath: parent.isOnSelectedPath && child.isOnSelectedPath,
      });
      connect(childTree);
    });
  };
  connect(tree);

  const maxRight = Math.max(...nodes.map((node) => node.x + node.width));
  const maxBottom = Math.max(...nodes.map((node) => node.y + node.height));
  return { nodes, links, width: maxRight + PADDING, height: maxBottom + PADDING };
}
