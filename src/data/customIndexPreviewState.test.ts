import { describe, expect, it } from 'vitest';
import type { IndustryIndexPreview } from './industryIndexPreview';
import type { StoredCustomIndex } from './customIndexStorage';
import { createLatestRequestGuard, resolveActiveCustomIndex } from './customIndexPreviewState';

const permanent: StoredCustomIndex = { id: 'same', name: '永久', description: '', tags: [], components: [], weightMethod: 'equal', rebalanceFrequency: 'monthly', createdAt: 'a', updatedAt: 'a' };
const preview: IndustryIndexPreview = { index: { ...permanent, name: '临时' }, sourcePath: ['行业'], totalCompanyCount: 0, createdAt: 'b' };

describe('custom index preview state', () => {
  it('selects the preview without changing or replacing permanent indices', () => {
    const indices = [permanent];
    expect(resolveActiveCustomIndex(indices, 'same', preview)).toBe(preview.index);
    expect(indices).toEqual([permanent]);
  });

  it('falls back to the permanent selection after preview is cleared or invalid', () => {
    expect(resolveActiveCustomIndex([permanent], 'same', null)).toBe(permanent);
    expect(resolveActiveCustomIndex([permanent], 'missing', null)).toBeNull();
  });

  it('accepts only the latest asynchronous request', () => {
    const guard = createLatestRequestGuard();
    const stale = guard.begin();
    const latest = guard.begin();
    expect(guard.isLatest(stale)).toBe(false);
    expect(guard.isLatest(latest)).toBe(true);
  });
});
