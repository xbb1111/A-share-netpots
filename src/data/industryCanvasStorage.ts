import { createIndustryCanvas, isIndustryCanvas, type IndustryCanvas } from './industryCanvas';

export const INDUSTRY_CANVAS_STORAGE_KEY = 'alpha-desk-industry-canvases';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
function getStorage(storage?: StorageLike): StorageLike | null { return storage ?? (typeof window === 'undefined' ? null : window.localStorage); }
export function loadIndustryCanvases(storage?: StorageLike): IndustryCanvas[] {
  try { const parsed = JSON.parse(getStorage(storage)?.getItem(INDUSTRY_CANVAS_STORAGE_KEY) ?? '[]') as unknown; return Array.isArray(parsed) ? parsed.filter(isIndustryCanvas) : []; } catch { return []; }
}
export function saveIndustryCanvases(canvases: IndustryCanvas[], storage?: StorageLike) { getStorage(storage)?.setItem(INDUSTRY_CANVAS_STORAGE_KEY, JSON.stringify(canvases)); }
export function importIndustryCanvas(canvas: IndustryCanvas, createId: () => string = () => crypto.randomUUID()): IndustryCanvas {
  return createIndustryCanvas({ ...canvas, id: createId(), name: `${canvas.name} 副本`, root: structuredClone(canvas.root) });
}
