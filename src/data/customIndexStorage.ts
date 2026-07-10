import type { CustomIndexConfig, IndexComponent, RebalanceFrequency, WeightMethod } from './customIndex';

export const CUSTOM_INDEX_STORAGE_KEY = 'alpha-desk-custom-indices';

export type StoredCustomIndex = CustomIndexConfig & {
  id: string;
  name: string;
  description: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function getStorage(storage?: StorageLike): StorageLike | null {
  if (storage) return storage;
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function isStoredCustomIndex(value: unknown): value is StoredCustomIndex {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<StoredCustomIndex>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    Array.isArray(candidate.components) &&
    typeof candidate.weightMethod === 'string' &&
    typeof candidate.rebalanceFrequency === 'string'
  );
}

export function loadCustomIndices(storage?: StorageLike): StoredCustomIndex[] {
  const source = getStorage(storage);
  if (!source) return [];

  try {
    const parsed = JSON.parse(source.getItem(CUSTOM_INDEX_STORAGE_KEY) ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.filter(isStoredCustomIndex) : [];
  } catch {
    return [];
  }
}

export function saveCustomIndices(indices: StoredCustomIndex[], storage?: StorageLike) {
  getStorage(storage)?.setItem(CUSTOM_INDEX_STORAGE_KEY, JSON.stringify(indices));
}

export function removeCustomIndex(indices: StoredCustomIndex[], id: string) {
  return indices.filter((index) => index.id !== id);
}

export function duplicateCustomIndex(index: StoredCustomIndex, createId: () => string = () => crypto.randomUUID()) {
  const now = new Date().toISOString();
  return {
    ...index,
    id: createId(),
    name: `${index.name} 副本`,
    components: index.components.map((component: IndexComponent) => ({ ...component })),
    tags: [...index.tags],
    createdAt: now,
    updatedAt: now,
  };
}

export function createCustomIndex(input: {
  name: string;
  description?: string;
  tags?: string[];
  components: IndexComponent[];
  weightMethod: WeightMethod;
  rebalanceFrequency: RebalanceFrequency;
  baseValue?: number;
}, createId: () => string = () => crypto.randomUUID()): StoredCustomIndex {
  const now = new Date().toISOString();
  return { ...input, id: createId(), description: input.description ?? '', tags: input.tags ?? [], createdAt: now, updatedAt: now };
}
