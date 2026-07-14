import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CanvasNode, IndustryCanvas } from '../data/industryCanvas';
import { getCanvasKeyboardAction, getCanvasKeyboardTarget } from './IndustryCanvasMindMap';
import { getCanvasNodeEditorState, IndustryCanvasNodeEditor } from './IndustryCanvasNodeEditor';

const leaf: CanvasNode = { id: 'leaf', name: '铜箔', stocks: [{ code: ' 300750 ', name: '宁德时代', change: 2, marketCap: 100, pe: 20 }], children: [] };
const root: CanvasNode = { id: 'root', name: '新能源', stocks: [{ code: '300750', name: '宁德时代', change: 2, marketCap: 100, pe: 20 }], children: [leaf, { id: 'other', name: '储能', stocks: [{ code: 'bad', name: '无代码', change: null, marketCap: null, pe: null }], children: [] }] };
const canvas: IndustryCanvas = { version: 1, id: 'c', name: '链', description: '', root, createdAt: '', updatedAt: '' };

describe('canvas node editor view model', () => {
  it('counts direct and unique recursive companies and exposes metric readiness', () => {
    expect(getCanvasNodeEditorState(root)).toMatchObject({ directCompanyCount: 1, branchCompanyCount: 2, peIncludedCount: 1, peTotalCount: 2, canUseMarketCap: false, hasPreviewableCompanies: true });
  });

  it('requires every unique branch company to have a positive finite market cap', () => {
    expect(getCanvasNodeEditorState(leaf).canUseMarketCap).toBe(true);
  });
});

describe('canvas keyboard navigation', () => {
  it('moves between parent, first child, and adjacent siblings', () => {
    expect(getCanvasKeyboardTarget(root, 'leaf', 'ArrowLeft')).toBe('root');
    expect(getCanvasKeyboardTarget(root, 'root', 'ArrowRight')).toBe('leaf');
    expect(getCanvasKeyboardTarget(root, 'leaf', 'ArrowDown')).toBe('other');
    expect(getCanvasKeyboardTarget(root, 'other', 'ArrowUp')).toBe('leaf');
  });

  it('maps Tab shortcuts outside form inputs and ignores them inside inputs', () => {
    expect(getCanvasKeyboardAction('Tab', false, false)).toBe('child');
    expect(getCanvasKeyboardAction('Tab', true, false)).toBe('sibling');
    expect(getCanvasKeyboardAction('Tab', false, true)).toBeNull();
  });
});

describe('IndustryCanvasNodeEditor markup', () => {
  it('renders inline form controls and protects root-only actions', () => {
    const html = renderToStaticMarkup(<IndustryCanvasNodeEditor canvas={canvas} node={root} path={[root]} onChange={() => undefined} onClose={() => undefined} />);
    expect(html).toContain('industry-canvas-node-editor');
    expect(html).toContain('textarea');
    expect(html).toMatch(/添加同级[\s\S]*disabled|disabled[^>]*>[\s\S]*添加同级/);
    expect(html).toMatch(/删除当前[\s\S]*disabled|disabled[^>]*>[\s\S]*删除当前/);
    expect(html).toMatch(/市值加权/);
  });

  it('disables preview and market-cap weighting without valid companies', () => {
    const empty: CanvasNode = { id: 'empty', name: '空分支', stocks: [], children: [] };
    const emptyCanvas = { ...canvas, root: empty };
    const html = renderToStaticMarkup(<IndustryCanvasNodeEditor canvas={emptyCanvas} node={empty} path={[empty]} onChange={() => undefined} onClose={() => undefined} />);
    expect(html).toContain('当前分支暂无可计算公司');
    expect((html.match(/disabled/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });
});
