import { describe, expect, it } from 'vitest';
import {
  addCanvasChild,
  collectBranchStocks,
  createIndustryCanvas,
  getBranchMetrics,
  removeCanvasNode,
  renameCanvasNode,
  addStockToCanvasNode,
  createCanvasSharePayload,
  parseCanvasSharePayload,
  findCanvasNode,
  updateCanvasNodeDescription,
  addCanvasSibling,
  removeStockFromCanvasNode,
} from './industryCanvas';

const canvas = createIndustryCanvas({
  id: 'canvas-1',
  name: '新能源车',
  root: {
    id: 'root', name: '产业链', stocks: [{ code: '000001', name: '平安银行', change: 1, marketCap: 100, pe: 10 }], children: [
      { id: 'materials', name: '材料', stocks: [{ code: '000002', name: '万科A', change: 3, marketCap: 300, pe: -2 }], children: [
        { id: 'lithium', name: '锂资源', stocks: [{ code: '000001', name: '平安银行', change: 1, marketCap: 100, pe: 10 }], children: [] },
      ] },
    ],
  },
});

describe('industry canvas model', () => {
  it('deduplicates descendant stocks and excludes non-positive PE values', () => {
    expect(collectBranchStocks(canvas.root).map((stock) => stock.code)).toEqual(['000001', '000002']);
    expect(getBranchMetrics(canvas.root)).toMatchObject({ companyCount: 2, averageChange: 2, averageMarketCap: 200, averagePe: 10, peCompanyCount: 1 });
  });

  it('updates recursive nodes immutably', () => {
    const added = addCanvasChild(canvas, 'lithium', { id: 'refining', name: '锂盐加工' });
    const renamed = renameCanvasNode(added, 'refining', '锂盐');
    const removed = removeCanvasNode(renamed, 'materials');
    expect(added.root.children[0].children[0].children[0].name).toBe('锂盐加工');
    expect(renamed.root.children[0].children[0].children[0].name).toBe('锂盐');
    expect(removed.root.children).toEqual([]);
    expect(canvas.root.children[0].children[0].children).toEqual([]);
  });

  it('round-trips a URL-safe share payload and rejects malformed links', () => {
    const payload = createCanvasSharePayload(canvas, 'https://example.test/#industries');
    expect(payload.kind).toBe('link');
    expect(parseCanvasSharePayload(payload.value)).toMatchObject({ id: 'canvas-1', name: '新能源车' });
    expect(parseCanvasSharePayload('https://example.test/#canvas=bad')).toBeNull();
  });

  it('uses copyable text when a link would exceed the safe URL length', () => {
    const large = { ...canvas, description: 'x'.repeat(7000) };
    expect(createCanvasSharePayload(large, 'https://example.test/').kind).toBe('text');
  });

  it('adds a stock once to a selected node', () => {
    const once = addStockToCanvasNode(canvas, 'materials', { code: '600000', name: '浦发银行', change: 2, marketCap: 50, pe: 5 });
    const twice = addStockToCanvasNode(once, 'materials', { code: '600000', name: '浦发银行', change: 2, marketCap: 50, pe: 5 });
    expect(twice.root.children[0].stocks.filter((stock) => stock.code === '600000')).toHaveLength(1);
  });

  it('finds deeply nested nodes without changing the tree', () => {
    expect(findCanvasNode(canvas.root, 'lithium')?.id).toBe('lithium');
    expect(findCanvasNode(canvas.root, 'missing')).toBeUndefined();
  });

  it('updates a deep node description immutably and touches the canvas', () => {
    const original = structuredClone(canvas);
    const updated = updateCanvasNodeDescription(canvas, 'lithium', 'upstream resource');
    expect(findCanvasNode(updated.root, 'lithium')?.description).toBe('upstream resource');
    expect(updated.root).not.toBe(canvas.root);
    expect(updated.updatedAt).not.toBe(canvas.updatedAt);
    expect(canvas).toEqual(original);
  });

  it('inserts a sibling immediately after a deeply selected node', () => {
    const updated = addCanvasSibling(canvas, 'lithium', { id: 'nickel', name: 'Nickel' });
    expect(updated.root.children[0].children.map((node) => node.id)).toEqual(['lithium', 'nickel']);
    expect(updated.root.children[0].children[1]).toMatchObject({ description: '', stocks: [], children: [] });
    expect(canvas.root.children[0].children).toHaveLength(1);
  });

  it('does not add a sibling to the root or modify anything for missing ids', () => {
    expect(addCanvasSibling(canvas, 'root', { id: 'x', name: 'X' })).toBe(canvas);
    expect(addCanvasSibling(canvas, 'missing', { id: 'x', name: 'X' })).toBe(canvas);
    expect(updateCanvasNodeDescription(canvas, 'missing', 'nope')).toBe(canvas);
    expect(removeStockFromCanvasNode(canvas, 'missing', '000001')).toBe(canvas);
  });

  it('removes a trimmed stock code only from the selected node and preserves descendants', () => {
    const original = structuredClone(canvas);
    const updated = removeStockFromCanvasNode(canvas, 'root', ' 000001 ');
    expect(updated.root.stocks).toEqual([]);
    expect(findCanvasNode(updated.root, 'lithium')?.stocks.map((stock) => stock.code)).toEqual(['000001']);
    expect(updated.updatedAt).not.toBe(canvas.updatedAt);
    expect(canvas).toEqual(original);
  });
});
