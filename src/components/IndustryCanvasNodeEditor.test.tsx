import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import type { CanvasNode, IndustryCanvas } from '../data/industryCanvas';
import { buildCanvasNavigationIndex, calculateFitTransform, createCanvasDragState, endCanvasDrag, getCanvasKeyboardAction, getCanvasKeyboardTarget, IndustryCanvasMindMap, shouldCollapseCanvasEditor, shouldStartCanvasPan, stepCanvasZoom } from './IndustryCanvasMindMap';
import { createLatestAsyncGuard, getCanvasNodeEditorState, IndustryCanvasNodeEditor, resolveCanvasWeightMethod } from './IndustryCanvasNodeEditor';

const leaf: CanvasNode = { id: 'leaf', name: '铜箔', stocks: [{ code: ' 300750 ', name: '宁德时代', change: 2, marketCap: 100, pe: 20 }], children: [] };
const root: CanvasNode = { id: 'root', name: '新能源', stocks: [{ code: '300750', name: '宁德时代', change: 2, marketCap: 100, pe: 20 }], children: [leaf, { id: 'other', name: '储能', stocks: [{ code: 'bad', name: '无代码', change: null, marketCap: null, pe: null }], children: [] }] };
const canvas: IndustryCanvas = { version: 1, id: 'c', name: '链', description: '', root, createdAt: '', updatedAt: '' };

describe('canvas node editor view model', () => {
  it('counts direct and unique recursive companies and exposes metric readiness', () => {
    expect(getCanvasNodeEditorState(root)).toMatchObject({ directCompanyCount: 1, branchCompanyCount: 2, peIncludedCount: 1, peTotalCount: 2, canUseMarketCap: true, hasPreviewableCompanies: true });
  });

  it('requires every unique branch company to have a positive finite market cap', () => {
    expect(getCanvasNodeEditorState(leaf).canUseMarketCap).toBe(true);
  });

  it('allows market-cap preview when at least one company qualifies and exposes included / total', () => {
    expect(getCanvasNodeEditorState(root)).toMatchObject({ canUseMarketCap: true, marketCapIncludedCount: 1, marketCapTotalCount: 2 });
  });
});

describe('canvas keyboard navigation', () => {
  it('moves between parent, first child, and adjacent siblings', () => {
    expect(getCanvasKeyboardTarget(root, 'leaf', 'ArrowLeft')).toBe('root');
    expect(getCanvasKeyboardTarget(root, 'root', 'ArrowRight')).toBe('leaf');
    expect(getCanvasKeyboardTarget(root, 'leaf', 'ArrowDown')).toBe('other');
    expect(getCanvasKeyboardTarget(root, 'other', 'ArrowUp')).toBe('leaf');
  });

  it('maps Insert shortcuts outside form inputs without taking over Tab', () => {
    expect(getCanvasKeyboardAction('Insert', false, false)).toBe('child');
    expect(getCanvasKeyboardAction('Insert', true, false)).toBe('sibling');
    expect(getCanvasKeyboardAction('Tab', false, false)).toBeNull();
    expect(getCanvasKeyboardAction('Insert', false, true)).toBeNull();
  });
});

describe('canvas pan and fit helpers', () => {
  it('starts pan only on marked blank viewport or surface', () => {
    const blank = { closest: (selector: string) => selector === '[data-canvas-pan-surface]' ? {} : null };
    const control = { closest: () => ({}) };
    expect(shouldStartCanvasPan(blank)).toBe(true);
    expect(shouldStartCanvasPan(control)).toBe(false);
  });

  it('fits wide and tall layouts with finite centered transforms and clamps zoom', () => {
    for (const result of [calculateFitTransform(800, 500, 2000, 300, 24), calculateFitTransform(800, 500, 300, 2000, 24)]) {
      expect(result.scale).toBeGreaterThanOrEqual(.1);
      expect(result.scale).toBeLessThanOrEqual(1.5);
      expect(Number.isFinite(result.x) && Number.isFinite(result.y)).toBe(true);
    }
    const fit = calculateFitTransform(500, 500, 2000, 300, 24);
    expect(2000 * fit.scale).toBeLessThanOrEqual(452);
    const huge = calculateFitTransform(500, 400, 100000, 200000, 24);
    expect(100000 * huge.scale).toBeLessThanOrEqual(452);
    expect(200000 * huge.scale).toBeLessThanOrEqual(352);
    const extreme = calculateFitTransform(500, 400, 1e20, 5e19, 24);
    expect(1e20 * extreme.scale).toBeLessThanOrEqual(452);
    expect(5e19 * extreme.scale).toBeLessThanOrEqual(352);
    expect(stepCanvasZoom(extreme.scale, 'out')).toBeLessThan(extreme.scale);
    expect(stepCanvasZoom(extreme.scale, 'in')).toBeGreaterThan(extreme.scale);
    expect(stepCanvasZoom(extreme.scale, 'out')).toBeGreaterThan(0);
  });

  it('clears drag only for the active pointer', () => {
    const drag = createCanvasDragState(7, 10, 20, 0, 0);
    expect(endCanvasDrag(drag, 8)).toBe(drag);
    expect(endCanvasDrag(drag, 7)).toBeNull();
  });
});

describe('canvas navigation index', () => {
  it('indexes large flat and deep trees with parent and sibling targets', () => {
    const children = Array.from({ length: 1000 }, (_, index) => ({ id: `n${index}`, name: `${index}`, stocks: [], children: [] } satisfies CanvasNode));
    const flat: CanvasNode = { id: 'r', name: 'r', stocks: [], children };
    const index = buildCanvasNavigationIndex(flat);
    expect(index.navigation.get('n500')?.ArrowUp).toBe('n499');
    let deep: CanvasNode = { id: 'end', name: 'end', stocks: [], children: [] };
    for (let i = 0; i < 500; i += 1) deep = { id: `d${i}`, name: `${i}`, stocks: [], children: [deep] };
    expect(buildCanvasNavigationIndex(deep).nodes.size).toBe(501);
  });

  it('collapses editors on Escape except during IME composition', () => {
    expect(shouldCollapseCanvasEditor('Escape', false)).toBe(true);
    expect(shouldCollapseCanvasEditor('Escape', true)).toBe(false);
    expect(shouldCollapseCanvasEditor('Enter', false)).toBe(false);
  });
});

describe('latest async guard', () => {
  it('invalidates stale and disposed requests', () => {
    const guard = createLatestAsyncGuard();
    const first = guard.next(); const second = guard.next();
    expect(guard.isCurrent(first)).toBe(false);
    expect(guard.isCurrent(second)).toBe(true);
    guard.dispose();
    expect(guard.isCurrent(second)).toBe(false);
  });
});

describe('canvas weighting', () => {
  it('falls back from unavailable market-cap weighting and disables empty equal weighting', () => {
    expect(resolveCanvasWeightMethod('marketCap', { hasPreviewableCompanies: true, canUseMarketCap: false })).toBe('equal');
    expect(resolveCanvasWeightMethod('equal', { hasPreviewableCompanies: false, canUseMarketCap: false })).toBe('equal');
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
    expect(html).toContain('纳入计算 1 / 分支公司 2');
  });

  it('disables preview and market-cap weighting without valid companies', () => {
    const empty: CanvasNode = { id: 'empty', name: '空分支', stocks: [], children: [] };
    const emptyCanvas = { ...canvas, root: empty };
    const html = renderToStaticMarkup(<IndustryCanvasNodeEditor canvas={emptyCanvas} node={empty} path={[empty]} onChange={() => undefined} onClose={() => undefined} />);
    expect(html).toContain('当前分支暂无可计算公司');
    expect((html.match(/disabled/g) ?? []).length).toBeGreaterThanOrEqual(4);
  });

  it('marks an expanded editor as the active tree item and focuses a newly-created name', () => {
    const map = renderToStaticMarkup(<IndustryCanvasMindMap canvas={canvas} selectedId="root" expandedId="root" onSelect={() => undefined} onExpand={() => undefined} onChange={() => undefined} />);
    expect(map).toMatch(/role="treeitem"[^>]*aria-selected="true"/);
    expect(map).toContain('role="group"');
    expect(map).toContain('role="region"');
    expect(map).not.toMatch(/role="treeitem"[^>]*><form/);
    expect(map).toContain('tabindex="-1"');
    const editor = renderToStaticMarkup(<IndustryCanvasNodeEditor canvas={canvas} node={root} path={[root]} focusName onChange={() => undefined} onClose={() => undefined} />);
    expect(editor).toContain('autofocus=""');
    expect(editor).toContain('直接标的');
    expect(editor).toContain('分支公司');
  });
});
