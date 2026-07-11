import { describe, expect, it } from 'vitest';
import { createIndustryCanvas } from './industryCanvas';
import { importIndustryCanvas, loadIndustryCanvases, saveIndustryCanvases } from './industryCanvasStorage';

function storage() { const data = new Map<string, string>(); return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) }; }
const source = createIndustryCanvas({ id: 'old', name: 'AI', root: { id: 'root', name: 'AI产业链', stocks: [], children: [] } });

describe('industry canvas storage', () => {
  it('persists validated canvases and imports as a new copy', () => {
    const local = storage();
    saveIndustryCanvases([source], local);
    expect(loadIndustryCanvases(local)).toEqual([source]);
    const imported = importIndustryCanvas(source, () => 'new');
    expect(imported.id).toBe('new');
    expect(imported.name).toContain('副本');
    expect(imported.id).not.toBe(source.id);
  });
});
