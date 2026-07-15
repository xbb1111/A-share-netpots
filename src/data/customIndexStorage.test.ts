import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  duplicateCustomIndex,
  loadCustomIndices,
  promoteCustomIndexPreview,
  removeCustomIndex,
  saveCustomIndices,
  trySaveCustomIndices,
  type StoredCustomIndex,
} from './customIndexStorage';
import type { IndustryIndexPreview } from './industryIndexPreview';

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  };
}

const preset: StoredCustomIndex = {
  id: 'one',
  name: '科技成长',
  description: '测试组合',
  tags: ['科技'],
  components: [{ code: 'AAA', name: '甲', industry: '科技', targetWeight: 100 }],
  weightMethod: 'custom',
  rebalanceFrequency: 'monthly',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('custom index storage', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('recovers from malformed local data', () => {
    expect(loadCustomIndices(createStorage({ 'alpha-desk-custom-indices': '{bad' }))).toEqual([]);
  });

  it('saves and reloads presets', () => {
    const storage = createStorage();
    saveCustomIndices([preset], storage);
    expect(loadCustomIndices(storage)).toEqual([preset]);
  });

  it('duplicates with a fresh id and removes by id', () => {
    const copied = duplicateCustomIndex(preset, () => 'copy-id');
    expect(copied.id).toBe('copy-id');
    expect(copied.name).toBe('科技成长 副本');
    expect(removeCustomIndex([preset, copied], 'one')).toEqual([copied]);
  });

  it('reports storage failure without pretending the indices were saved', () => {
    const throwingStorage = {
      getItem: () => null,
      setItem: () => { throw new DOMException('quota', 'QuotaExceededError'); },
      removeItem: () => undefined,
    };
    expect(trySaveCustomIndices([preset], throwingStorage)).toBe(false);
  });

  it('reports successful storage before preview cleanup may continue', () => {
    const storage = createStorage();
    expect(trySaveCustomIndices([preset], storage)).toBe(true);
    expect(loadCustomIndices(storage)).toEqual([preset]);
  });

  it('reports failure when no browser storage exists', () => {
    vi.stubGlobal('window', undefined);
    expect(trySaveCustomIndices([preset])).toBe(false);
  });

  it('promotes a preview by replacing the same id without duplicates', () => {
    const preview: IndustryIndexPreview = {
      index: { ...preset, name: '临时行业指数', updatedAt: '2026-02-01T00:00:00.000Z' },
      sourcePath: ['行业全景', '新能源'],
      totalCompanyCount: 1,
      createdAt: preset.createdAt,
    };
    const other = { ...preset, id: 'other' };
    expect(promoteCustomIndexPreview([preset, other, preset], preview)).toEqual([preview.index, other]);
  });
});
