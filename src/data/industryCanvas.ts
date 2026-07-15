export type CanvasStock = {
  code: string;
  name: string;
  industry?: string;
  change: number | null;
  marketCap: number | null;
  pe: number | null;
};

export type CanvasNode = { id: string; name: string; description?: string; stocks: CanvasStock[]; children: CanvasNode[] };
export type IndustryCanvas = { version: 1; id: string; name: string; description: string; root: CanvasNode; createdAt: string; updatedAt: string };
export type BranchMetrics = { companyCount: number; averageChange: number | null; averageMarketCap: number | null; averagePe: number | null; peCompanyCount: number };

const now = () => new Date().toISOString();
export const normalizeStockCode = (code: string) => code.trim();
const average = (values: Array<number | null>) => {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};

export function createIndustryCanvas(input: Pick<IndustryCanvas, 'id' | 'name' | 'root'> & Partial<Pick<IndustryCanvas, 'description' | 'createdAt' | 'updatedAt'>>): IndustryCanvas {
  const time = now();
  return { version: 1, description: '', createdAt: time, updatedAt: time, ...input };
}

export function collectBranchStocks(node: CanvasNode): CanvasStock[] {
  const seen = new Set<string>();
  const result: CanvasStock[] = [];
  const stack = [node];
  while (stack.length) {
    const current = stack.pop()!;
    current.stocks.forEach((stock) => {
      const code = normalizeStockCode(stock.code);
      if (!seen.has(code)) { seen.add(code); result.push(code === stock.code ? stock : { ...stock, code }); }
    });
    for (let index = current.children.length - 1; index >= 0; index -= 1) stack.push(current.children[index]);
  }
  return result;
}

export function getBranchMetrics(node: CanvasNode): BranchMetrics {
  const stocks = collectBranchStocks(node);
  const pe = stocks.map((stock) => stock.pe).filter((value): value is number => typeof value === 'number' && value > 0 && Number.isFinite(value));
  const marketCaps = stocks.map((stock) => stock.marketCap).filter((value): value is number => typeof value === 'number' && value > 0 && Number.isFinite(value));
  return { companyCount: stocks.length, averageChange: average(stocks.map((stock) => stock.change)), averageMarketCap: average(marketCaps), averagePe: average(pe), peCompanyCount: pe.length };
}

function findNodePath(root: CanvasNode, id: string): CanvasNode[] | undefined {
  const stack: CanvasNode[] = [root];
  const parents = new Map<CanvasNode, CanvasNode | undefined>([[root, undefined]]);
  while (stack.length) {
    const node = stack.pop()!;
    if (node.id === id) {
      const path: CanvasNode[] = [];
      for (let current: CanvasNode | undefined = node; current; current = parents.get(current)) path.push(current);
      return path.reverse();
    }
    for (let index = node.children.length - 1; index >= 0; index -= 1) {
      parents.set(node.children[index], node);
      stack.push(node.children[index]);
    }
  }
  return undefined;
}

function rebuildPath(path: CanvasNode[], changed: CanvasNode): CanvasNode {
  let rebuilt = changed;
  for (let index = path.length - 2; index >= 0; index -= 1) {
    const parent = path[index];
    const childIndex = parent.children.indexOf(path[index + 1]);
    const children = [...parent.children];
    children[childIndex] = rebuilt;
    rebuilt = { ...parent, children };
  }
  return rebuilt;
}

function updateNode(node: CanvasNode, id: string, updater: (item: CanvasNode) => CanvasNode): CanvasNode {
  const path = findNodePath(node, id);
  if (!path) return node;
  const changed = updater(path[path.length - 1]);
  return changed === path[path.length - 1] ? node : rebuildPath(path, changed);
}
function touch(canvas: IndustryCanvas, root: CanvasNode): IndustryCanvas {
  if (root === canvas.root) return canvas;
  const currentTime = Date.now();
  const previousTime = Date.parse(canvas.updatedAt);
  const updatedAt = new Date(Number.isFinite(previousTime) ? Math.max(currentTime, previousTime + 1) : currentTime).toISOString();
  return { ...canvas, root, updatedAt };
}

export function findCanvasNode(root: CanvasNode, id: string): CanvasNode | undefined {
  return findNodePath(root, id)?.at(-1);
}

export function hasCanvasNodeId(root: CanvasNode, id: string): boolean {
  return findCanvasNode(root, id) !== undefined;
}

function canInsertCanvasSubtree(root: CanvasNode, candidate: CanvasNode): boolean {
  const existing = new Set<string>();
  const existingStack = [root];
  while (existingStack.length) {
    const node = existingStack.pop()!;
    existing.add(node.id);
    node.children.forEach((child) => existingStack.push(child));
  }
  const candidateIds = new Set<string>();
  const candidateStack = [candidate];
  while (candidateStack.length) {
    const node = candidateStack.pop()!;
    if (existing.has(node.id) || candidateIds.has(node.id)) return false;
    candidateIds.add(node.id);
    node.children.forEach((child) => candidateStack.push(child));
  }
  return true;
}

export function updateCanvasNodeDescription(canvas: IndustryCanvas, id: string, description: string): IndustryCanvas {
  return touch(canvas, updateNode(canvas.root, id, (node) => (node.description ?? '') === description ? node : { ...node, description }));
}

export function addCanvasSibling(canvas: IndustryCanvas, nodeId: string, childData: Pick<CanvasNode, 'id' | 'name'> & Partial<CanvasNode>): IndustryCanvas {
  if (canvas.root.id === nodeId) return canvas;
  const sibling: CanvasNode = { description: '', stocks: [], children: [], ...childData };
  if (!canInsertCanvasSubtree(canvas.root, sibling)) return canvas;
  const path = findNodePath(canvas.root, nodeId);
  if (!path || path.length < 2) return canvas;
  const parent = path[path.length - 2];
  const children = [...parent.children];
  children.splice(children.indexOf(path[path.length - 1]) + 1, 0, sibling);
  return touch(canvas, rebuildPath(path.slice(0, -1), { ...parent, children }));
}

export function removeStockFromCanvasNode(canvas: IndustryCanvas, nodeId: string, code: string): IndustryCanvas {
  const normalizedCode = normalizeStockCode(code);
  return touch(canvas, updateNode(canvas.root, nodeId, (node) => {
    const stocks = node.stocks.filter((stock) => normalizeStockCode(stock.code) !== normalizedCode);
    return stocks.length === node.stocks.length ? node : { ...node, stocks };
  }));
}

export function addCanvasChild(canvas: IndustryCanvas, parentId: string, child: Pick<CanvasNode, 'id' | 'name'> & Partial<CanvasNode>): IndustryCanvas {
  const node: CanvasNode = { description: '', stocks: [], children: [], ...child };
  if (!canInsertCanvasSubtree(canvas.root, node)) return canvas;
  return touch(canvas, updateNode(canvas.root, parentId, (parent) => ({ ...parent, children: [...parent.children, node] })));
}
export function renameCanvasNode(canvas: IndustryCanvas, id: string, name: string): IndustryCanvas { return touch(canvas, updateNode(canvas.root, id, (node) => node.name === name ? node : { ...node, name })); }
export function removeCanvasNode(canvas: IndustryCanvas, id: string): IndustryCanvas {
  if (canvas.root.id === id) return canvas;
  const path = findNodePath(canvas.root, id);
  if (!path || path.length < 2) return canvas;
  const parent = path[path.length - 2];
  const changedParent = { ...parent, children: parent.children.filter((child) => child !== path[path.length - 1]) };
  return touch(canvas, rebuildPath(path.slice(0, -1), changedParent));
}
export function addStockToCanvasNode(canvas: IndustryCanvas, id: string, stock: CanvasStock): IndustryCanvas {
  const code = normalizeStockCode(stock.code);
  return touch(canvas, updateNode(canvas.root, id, (node) => node.stocks.some((item) => normalizeStockCode(item.code) === code) ? node : { ...node, stocks: [...node.stocks, { ...stock, code }] }));
}

export function updateCanvasStock(canvas: IndustryCanvas, id: string, stock: CanvasStock): IndustryCanvas {
  const code = normalizeStockCode(stock.code);
  return touch(canvas, updateNode(canvas.root, id, (node) => {
    const index = node.stocks.findIndex((item) => normalizeStockCode(item.code) === code);
    if (index < 0) return node;
    const stocks = [...node.stocks];
    stocks[index] = { ...stocks[index], ...stock, code };
    return { ...node, stocks };
  }));
}

export function isIndustryCanvas(value: unknown): value is IndustryCanvas {
  if (!value || typeof value !== 'object' || (value as IndustryCanvas).version !== 1 || typeof (value as IndustryCanvas).id !== 'string' || typeof (value as IndustryCanvas).name !== 'string') return false;
  const root = (value as IndustryCanvas).root as unknown;
  const stack: unknown[] = [root];
  const ids = new Set<string>();
  while (stack.length) {
    const item = stack.pop();
    if (!item || typeof item !== 'object') return false;
    const node = item as CanvasNode;
    if (typeof node.id !== 'string' || ids.has(node.id) || typeof node.name !== 'string' || !Array.isArray(node.stocks) || !Array.isArray(node.children)) return false;
    ids.add(node.id);
    node.children.forEach((child) => stack.push(child));
  }
  return true;
}

function toBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
function fromBase64Url(value: string) {
  const binary = atob(value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - value.length % 4) % 4));
  return new TextDecoder().decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
}
export type CanvasSharePayload = { kind: 'link' | 'text'; value: string };
export function createCanvasSharePayload(canvas: IndustryCanvas, baseUrl: string): CanvasSharePayload {
  const raw = JSON.stringify(canvas);
  const link = `${baseUrl.split('#')[0]}#canvas=${toBase64Url(raw)}`;
  return link.length <= 6000 ? { kind: 'link', value: link } : { kind: 'text', value: raw };
}
export function parseCanvasSharePayload(input: string): IndustryCanvas | null {
  try {
    const encoded = input.match(/[#&]canvas=([^&]+)/)?.[1];
    const value = encoded ? fromBase64Url(encoded) : input.trim();
    const parsed = JSON.parse(value) as unknown;
    return isIndustryCanvas(parsed) ? parsed : null;
  } catch { return null; }
}
