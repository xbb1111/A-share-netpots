import { collectBranchStocks, type CanvasNode } from './industryCanvas';
import type { WeightMethod } from './customIndex';
import { createCustomIndex, type StoredCustomIndex } from './customIndexStorage';

export type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type IndustryIndexPreview = { index: StoredCustomIndex; sourcePath: string[]; totalCompanyCount: number; createdAt: string };
export type IndustryIndexPreviewRequest = { node: CanvasNode; method: Extract<WeightMethod, 'equal' | 'marketCap'>; sourcePath: string[]; totalCompanyCount: number };

const PREVIEW_KEY_PREFIX = 'industry-index-preview:';
const keyFor = (id: string) => `${PREVIEW_KEY_PREFIX}${id}`;
const validSecurityCode = (code: string) => /^\d{6}$/.test(code.trim());
function defaultStorage(): StorageLike | null { if (typeof window === 'undefined') return null; try { return window.sessionStorage; } catch { return null; } }

export function getComputableBranchStocks(node: CanvasNode) {
  const seen = new Set<string>();
  return collectBranchStocks(node).flatMap((stock) => {
    const code = stock.code.trim();
    if (!validSecurityCode(code) || seen.has(code)) return [];
    seen.add(code);
    return [{ ...stock, code }];
  });
}

export function buildIndustryIndexPreview(node: CanvasNode, method: IndustryIndexPreviewRequest['method'], sourcePath: string[], createId: () => string = () => crypto.randomUUID()): IndustryIndexPreview {
  const stocks = getComputableBranchStocks(node);
  const index = createCustomIndex({
    name: `${node.name} 指数`, description: '行业或产业链生成的临时指数预览', tags: ['行业预览'],
    components: stocks.map((stock) => ({ name: stock.name, code: stock.code.trim(), industry: stock.industry ?? '产业链', marketCap: stock.marketCap ?? undefined })),
    weightMethod: method, rebalanceFrequency: 'monthly', baseValue: 100,
  }, createId);
  return { index, sourcePath: [...sourcePath], totalCompanyCount: stocks.length, createdAt: index.createdAt };
}

export function saveIndustryIndexPreview(preview: IndustryIndexPreview, storage?: StorageLike) { (storage ?? defaultStorage())?.setItem(keyFor(preview.index.id), JSON.stringify(preview)); }
export function loadIndustryIndexPreview(id: string, storage?: StorageLike): IndustryIndexPreview | null {
  const source = storage ?? defaultStorage(); if (!source) return null;
  try {
    const raw = source.getItem(keyFor(id)); if (!raw) return null;
    const value = JSON.parse(raw) as Partial<IndustryIndexPreview>;
    return value.index?.id === id && Array.isArray(value.sourcePath) && typeof value.totalCompanyCount === 'number' && typeof value.createdAt === 'string' ? value as IndustryIndexPreview : null;
  } catch { return null; }
}
export function removeIndustryIndexPreview(id: string, storage?: StorageLike) { (storage ?? defaultStorage())?.removeItem(keyFor(id)); }
export function consumeIndustryIndexPreview(id: string, storage?: StorageLike) { const preview = loadIndustryIndexPreview(id, storage); if (preview) removeIndustryIndexPreview(id, storage); return preview; }
export function toIndustryIndexPreviewHash(id: string) { return `toolbox?tool=index&preview=${encodeURIComponent(id)}`; }
