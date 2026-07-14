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
export const MAX_EXPANDED_WIDTH = 1200;
export const MAX_EXPANDED_HEIGHT = 1600;

export function getCanvasNodePath(root: CanvasNode, selectedId: string): CanvasNode[] {
  const stack = [root];
  const parents = new Map<CanvasNode, CanvasNode | undefined>([[root, undefined]]);
  let selected: CanvasNode | undefined;
  while (stack.length) {
    const node = stack.pop()!;
    if (node.id === selectedId) { selected = node; break; }
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      parents.set(node.children[index], node);
      stack.push(node.children[index]);
    }
  }
  if (!selected) return [root];
  const path: CanvasNode[] = [];
  for (let current: CanvasNode | undefined = selected; current; current = parents.get(current)) path.push(current);
  return path.reverse();
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

const expandedDimension = (value: number | undefined, minimum: number, maximum: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : minimum;

export function layoutCanvasMindMap(root: CanvasNode, selectedId = root.id, options: MindMapLayoutOptions = {}): MindMapLayout {
  const sourceStack = [root];
  const ids = new Set<string>();
  while (sourceStack.length) {
    const node = sourceStack.pop()!;
    if (ids.has(node.id)) throw new Error(`Duplicate canvas node id: ${node.id}`);
    ids.add(node.id);
    for (let index = node.children.length - 1; index >= 0; index -= 1) sourceStack.push(node.children[index]);
  }
  const path = new Set(getCanvasNodePath(root, selectedId).map((node) => node.id));
  const nodes: MindMapNode[] = [];
  const links: MindMapLink[] = [];

  const measured = new Map<CanvasNode, LayoutTree>();
  const measureStack: Array<{ node: CanvasNode; depth: number; visited: boolean }> = [{ node: root, depth: 0, visited: false }];
  while (measureStack.length) {
    const item = measureStack.pop()!;
    if (!item.visited) {
      measureStack.push({ ...item, visited: true });
      for (let index = item.node.children.length - 1; index >= 0; index -= 1) measureStack.push({ node: item.node.children[index], depth: item.depth + 1, visited: false });
      continue;
    }
    const expanded = item.node.id === options.expandedId;
    const width = expanded ? expandedDimension(options.expandedWidth, NODE_WIDTH, MAX_EXPANDED_WIDTH) : NODE_WIDTH;
    const height = expanded ? expandedDimension(options.expandedHeight, NODE_HEIGHT, MAX_EXPANDED_HEIGHT) : NODE_HEIGHT;
    const children = item.node.children.map((child) => measured.get(child)!);
    const childrenHeight = children.reduce((sum, child) => sum + child.subtreeHeight, 0) + Math.max(0, children.length - 1) * ROW_GAP;
    measured.set(item.node, { source: item.node, depth: item.depth, width, height, children, subtreeHeight: Math.max(height, childrenHeight) });
  }
  const tree = measured.get(root)!;
  const columnWidths: number[] = [];
  const widthStack = [tree];
  while (widthStack.length) {
    const item = widthStack.pop()!;
    columnWidths[item.depth] = Math.max(columnWidths[item.depth] ?? 0, item.width);
    item.children.forEach((child) => widthStack.push(child));
  }
  const columnX: number[] = [];
  columnWidths.forEach((_, depth) => {
    columnX[depth] = depth === 0 ? PADDING : columnX[depth - 1] + columnWidths[depth - 1] + COLUMN_GAP;
  });

  const placedById = new Map<string, MindMapNode>();
  const placeStack: Array<{ item: LayoutTree; top: number }> = [{ item: tree, top: PADDING }];
  while (placeStack.length) {
    const { item, top } = placeStack.pop()!;
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
    const childPlacements: Array<{ item: LayoutTree; top: number }> = [];
    item.children.forEach((child) => {
      childPlacements.push({ item: child, top: childTop });
      childTop += child.subtreeHeight + ROW_GAP;
    });
    for (let index = childPlacements.length - 1; index >= 0; index -= 1) placeStack.push(childPlacements[index]);
  }

  const connectStack = [tree];
  while (connectStack.length) {
    const item = connectStack.pop()!;
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
      connectStack.push(childTree);
    });
  }

  const maxRight = Math.max(...nodes.map((node) => node.x + node.width));
  const maxBottom = Math.max(...nodes.map((node) => node.y + node.height));
  return { nodes, links, width: maxRight + PADDING, height: maxBottom + PADDING };
}
