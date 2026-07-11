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
  const visit = (current: CanvasNode) => {
    current.stocks.forEach((stock) => { if (!seen.has(stock.code)) { seen.add(stock.code); result.push(stock); } });
    current.children.forEach(visit);
  };
  visit(node);
  return result;
}

export function getBranchMetrics(node: CanvasNode): BranchMetrics {
  const stocks = collectBranchStocks(node);
  const pe = stocks.map((stock) => stock.pe).filter((value): value is number => typeof value === 'number' && value > 0 && Number.isFinite(value));
  return { companyCount: stocks.length, averageChange: average(stocks.map((stock) => stock.change)), averageMarketCap: average(stocks.map((stock) => stock.marketCap)), averagePe: average(pe), peCompanyCount: pe.length };
}

function updateNode(node: CanvasNode, id: string, updater: (item: CanvasNode) => CanvasNode): CanvasNode {
  if (node.id === id) return updater(node);
  const children = node.children.map((child) => updateNode(child, id, updater));
  return children.some((child, index) => child !== node.children[index]) ? { ...node, children } : node;
}
function touch(canvas: IndustryCanvas, root: CanvasNode): IndustryCanvas { return { ...canvas, root, updatedAt: now() }; }

export function addCanvasChild(canvas: IndustryCanvas, parentId: string, child: Pick<CanvasNode, 'id' | 'name'> & Partial<CanvasNode>): IndustryCanvas {
  const node: CanvasNode = { description: '', stocks: [], children: [], ...child };
  return touch(canvas, updateNode(canvas.root, parentId, (parent) => ({ ...parent, children: [...parent.children, node] })));
}
export function renameCanvasNode(canvas: IndustryCanvas, id: string, name: string): IndustryCanvas { return touch(canvas, updateNode(canvas.root, id, (node) => ({ ...node, name }))); }
export function removeCanvasNode(canvas: IndustryCanvas, id: string): IndustryCanvas {
  if (canvas.root.id === id) return canvas;
  const remove = (node: CanvasNode): CanvasNode => ({ ...node, children: node.children.filter((child) => child.id !== id).map(remove) });
  return touch(canvas, remove(canvas.root));
}
export function addStockToCanvasNode(canvas: IndustryCanvas, id: string, stock: CanvasStock): IndustryCanvas {
  return touch(canvas, updateNode(canvas.root, id, (node) => node.stocks.some((item) => item.code === stock.code) ? node : { ...node, stocks: [...node.stocks, stock] }));
}

export function isIndustryCanvas(value: unknown): value is IndustryCanvas {
  const node = (item: unknown): item is CanvasNode => !!item && typeof item === 'object' && typeof (item as CanvasNode).id === 'string' && typeof (item as CanvasNode).name === 'string' && Array.isArray((item as CanvasNode).stocks) && Array.isArray((item as CanvasNode).children) && (item as CanvasNode).children.every(node);
  return !!value && typeof value === 'object' && (value as IndustryCanvas).version === 1 && typeof (value as IndustryCanvas).id === 'string' && typeof (value as IndustryCanvas).name === 'string' && node((value as IndustryCanvas).root);
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
