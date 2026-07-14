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

const isRecord = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object';
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.every((item) => typeof item === 'string');
const isOptionalString = (value: unknown) => value === undefined || typeof value === 'string';
const isOptionalBoolean = (value: unknown) => value === undefined || typeof value === 'boolean';
const isOptionalFiniteNumber = (value: unknown) => value === undefined || (typeof value === 'number' && Number.isFinite(value));

function isIndexComponent(value: unknown) {
  if (!isRecord(value)) return false;
  return typeof value.code === 'string' && typeof value.name === 'string' && typeof value.industry === 'string'
    && isOptionalFiniteNumber(value.marketCap) && isOptionalFiniteNumber(value.targetWeight);
}

function isStoredPreviewIndex(value: unknown): value is StoredCustomIndex {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.description === 'string'
    && isStringArray(value.tags)
    && typeof value.createdAt === 'string'
    && typeof value.updatedAt === 'string'
    && Array.isArray(value.components) && value.components.every(isIndexComponent)
    && (value.weightMethod === 'equal' || value.weightMethod === 'marketCap' || value.weightMethod === 'custom')
    && (value.rebalanceFrequency === 'none' || value.rebalanceFrequency === 'monthly' || value.rebalanceFrequency === 'quarterly' || value.rebalanceFrequency === 'semiannual' || value.rebalanceFrequency === 'annual')
    && (value.period === undefined || value.period === '15m' || value.period === '30m' || value.period === '60m' || value.period === 'daily' || value.period === 'weekly')
    && isOptionalFiniteNumber(value.baseValue)
    && isOptionalString(value.baseDate)
    && isOptionalString(value.benchmarkCode)
    && isOptionalBoolean(value.showBenchmark);
}

export function isIndustryIndexPreview(value: unknown): value is IndustryIndexPreview {
  if (!isRecord(value)) return false;
  return isStoredPreviewIndex(value.index)
    && isStringArray(value.sourcePath)
    && typeof value.totalCompanyCount === 'number' && Number.isFinite(value.totalCompanyCount) && value.totalCompanyCount >= 0
    && typeof value.createdAt === 'string';
}

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
    const value: unknown = JSON.parse(raw);
    return isIndustryIndexPreview(value) && value.index.id === id ? value : null;
  } catch { return null; }
}
export function removeIndustryIndexPreview(id: string, storage?: StorageLike) { (storage ?? defaultStorage())?.removeItem(keyFor(id)); }
export function consumeIndustryIndexPreview(id: string, storage?: StorageLike) { const preview = loadIndustryIndexPreview(id, storage); if (preview) removeIndustryIndexPreview(id, storage); return preview; }
export function toIndustryIndexPreviewHash(id: string) { return `toolbox?tool=index&preview=${encodeURIComponent(id)}`; }
