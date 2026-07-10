import { describe, expect, it } from 'vitest';
import {
  duplicateCustomIndex,
  loadCustomIndices,
  removeCustomIndex,
  saveCustomIndices,
  type StoredCustomIndex,
} from './customIndexStorage';

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
});
