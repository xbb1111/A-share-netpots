import type { StoredCustomIndex } from './customIndexStorage';
import type { IndustryIndexPreview } from './industryIndexPreview';

export function resolveActiveCustomIndex(indices: StoredCustomIndex[], selectedId: string | null, preview: IndustryIndexPreview | null) {
  if (preview) return preview.index;
  return indices.find((index) => index.id === selectedId) ?? null;
}

export function createLatestRequestGuard() {
  let sequence = 0;
  return {
    begin: () => ++sequence,
    isLatest: (request: number) => request === sequence,
  };
}
