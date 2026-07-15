import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CanvasNode } from '../data/industryCanvas';
import type { IndustryCanvas } from '../data/industryCanvas';
import { getCanvasBranchPreviewState, IndustryCanvasEditor } from './IndustryCanvasEditor';

const leaf: CanvasNode = { id: 'leaf', name: '铜箔', stocks: [{ code: 'bad', name: '非法', change: null, marketCap: null, pe: null }], children: [] };

describe('IndustryCanvasEditor preview state', () => {
  it('disables an invalid recursive branch with an explicit message', () => {
    const state = getCanvasBranchPreviewState(leaf, [{ id: 'root', name: '新能源', stocks: [], children: [leaf] }, leaf]);
    expect(state).toEqual({ disabled: true, companyCount: 0, pathNames: ['新能源', '铜箔'], message: '当前分支暂无可计算公司' });
  });

  it('preserves the full selected path and counts valid descendants', () => {
    const stock = { code: '300750 ', name: '宁德时代', change: null, marketCap: 1, pe: null };
    const child: CanvasNode = { id: 'child', name: '电池', stocks: [], children: [{ id: 'leaf', name: '电芯', stocks: [stock], children: [] }] };
    const root: CanvasNode = { id: 'root', name: '新能源', stocks: [], children: [child] };
    expect(getCanvasBranchPreviewState(child, [root, child])).toMatchObject({ disabled: false, companyCount: 1, pathNames: ['新能源', '电池'] });
  });
});

describe('IndustryCanvasEditor shell', () => {
  it('renders the canvas without the legacy fixed inspector', () => {
    const root: CanvasNode = { id: 'root', name: '新能源', stocks: [], children: [] };
    const canvas: IndustryCanvas = { version: 1, id: 'canvas', name: '产业链', description: '', root, createdAt: '', updatedAt: '' };
    const html = renderToStaticMarkup(<IndustryCanvasEditor canvas={canvas} onChange={() => undefined} onSave={() => undefined} />);
    expect(html).toContain('industry-mind-map');
    expect(html).not.toContain('industry-canvas-inspector');
  });
});
