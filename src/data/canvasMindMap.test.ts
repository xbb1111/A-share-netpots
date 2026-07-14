import { describe, expect, it } from 'vitest';
import { getCanvasNodePath, layoutCanvasMindMap, rectanglesOverlap } from './canvasMindMap';
import type { CanvasNode } from './industryCanvas';

const root: CanvasNode = {
  id: 'root', name: '新能源汽车', stocks: [], children: [
    { id: 'lithium', name: '锂资源', stocks: [], children: [] },
    { id: 'battery', name: '动力电池', stocks: [], children: [
      { id: 'cell', name: '电芯', stocks: [], children: [] },
      { id: 'pack', name: 'PACK', stocks: [], children: [] },
    ] },
  ],
};

describe('canvas mind map layout', () => {
  it('lays every node out deterministically by depth and joins parents to children', () => {
    const first = layoutCanvasMindMap(root, 'pack');
    const second = layoutCanvasMindMap(root, 'pack');
    expect(first).toEqual(second);
    expect(first.nodes).toHaveLength(5);
    expect(first.links).toHaveLength(4);
    expect(first.nodes.find((node) => node.id === 'root')?.depth).toBe(0);
    expect(first.nodes.find((node) => node.id === 'cell')?.depth).toBe(2);
    expect(first.nodes.find((node) => node.id === 'pack')?.isOnSelectedPath).toBe(true);
    expect(first.nodes.find((node) => node.id === 'battery')?.isOnSelectedPath).toBe(true);
    expect(first.nodes.find((node) => node.id === 'lithium')?.isOnSelectedPath).toBe(false);
    expect(getCanvasNodePath(root, 'pack').map((node) => node.id)).toEqual(['root', 'battery', 'pack']);
    expect(first.nodes.every((node) => node.x >= 0 && node.y >= 0 && node.x + node.width <= first.width && node.y + node.height <= first.height)).toBe(true);
  });

  it('uses expanded dimensions with minimum clamps while leaving other nodes at default size', () => {
    const layout = layoutCanvasMindMap(root, 'cell', { expandedId: 'cell', expandedWidth: 420, expandedHeight: 260 });
    expect(layout.nodes.find((node) => node.id === 'cell')).toMatchObject({ width: 420, height: 260 });
    expect(layout.nodes.find((node) => node.id === 'pack')).toMatchObject({ width: 172, height: 62 });

    const clamped = layoutCanvasMindMap(root, 'cell', { expandedId: 'cell', expandedWidth: -10, expandedHeight: Number.NaN });
    expect(clamped.nodes.find((node) => node.id === 'cell')).toMatchObject({ width: 172, height: 62 });
  });

  it('does not overlap any rectangles for wide or tall expanded editors', () => {
    for (const options of [
      { expandedId: 'battery', expandedWidth: 700, expandedHeight: 62 },
      { expandedId: 'battery', expandedWidth: 172, expandedHeight: 700 },
      { expandedId: 'cell', expandedWidth: 520, expandedHeight: 480 },
    ]) {
      const layout = layoutCanvasMindMap(root, 'battery', options);
      for (let i = 0; i < layout.nodes.length; i += 1) {
        for (let j = i + 1; j < layout.nodes.length; j += 1) {
          expect(rectanglesOverlap(layout.nodes[i], layout.nodes[j])).toBe(false);
        }
      }
    }
  });

  it('centers each parent on its child subtree and connects actual node edges', () => {
    const layout = layoutCanvasMindMap(root, 'battery', { expandedId: 'battery', expandedWidth: 450, expandedHeight: 300 });
    const battery = layout.nodes.find((node) => node.id === 'battery')!;
    const cell = layout.nodes.find((node) => node.id === 'cell')!;
    const pack = layout.nodes.find((node) => node.id === 'pack')!;
    expect(battery.y + battery.height / 2).toBe((cell.y + cell.height / 2 + pack.y + pack.height / 2) / 2);
    const link = layout.links.find((item) => item.parentId === 'battery' && item.childId === 'cell')!;
    expect(link.from).toEqual({ x: battery.x + battery.width, y: battery.y + battery.height / 2 });
    expect(link.to).toEqual({ x: cell.x, y: cell.y + cell.height / 2 });
  });

  it('treats touching rectangle edges as non-overlapping', () => {
    expect(rectanglesOverlap(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 10, y: 0, width: 10, height: 10 },
    )).toBe(false);
    expect(rectanglesOverlap(
      { x: 0, y: 0, width: 10, height: 10 },
      { x: 9, y: 0, width: 10, height: 10 },
    )).toBe(true);
  });

  it('keeps a deep single chain and many siblings finite, bounded, and non-overlapping', () => {
    let chain: CanvasNode = { id: 'leaf', name: 'leaf', stocks: [], children: [] };
    for (let index = 19; index >= 0; index -= 1) chain = { id: `chain-${index}`, name: `${index}`, stocks: [], children: [chain] };
    const wide: CanvasNode = {
      id: 'wide-root', name: 'wide', stocks: [],
      children: Array.from({ length: 80 }, (_, index) => ({ id: `child-${index}`, name: `${index}`, stocks: [], children: [] })),
    };

    for (const layout of [
      layoutCanvasMindMap(chain, 'leaf', { expandedId: 'chain-10', expandedWidth: 600, expandedHeight: 400 }),
      layoutCanvasMindMap(wide, 'child-40', { expandedId: 'child-40', expandedWidth: 500, expandedHeight: 300 }),
    ]) {
      expect(layout.nodes.length).toBeGreaterThan(20);
      expect(layout.nodes.every((node) => [node.x, node.y, node.width, node.height].every(Number.isFinite)
        && node.x >= 0 && node.y >= 0 && node.width >= 0 && node.height >= 0
        && node.x + node.width <= layout.width && node.y + node.height <= layout.height)).toBe(true);
      for (let i = 0; i < layout.nodes.length; i += 1) {
        for (let j = i + 1; j < layout.nodes.length; j += 1) expect(rectanglesOverlap(layout.nodes[i], layout.nodes[j])).toBe(false);
      }
    }
  });

  it('lays out more than 100 nodes deterministically without overlaps', () => {
    const large: CanvasNode = {
      id: 'large-root', name: 'large', stocks: [],
      children: Array.from({ length: 12 }, (_, branch) => ({
        id: `branch-${branch}`, name: `${branch}`, stocks: [],
        children: Array.from({ length: 9 }, (_, leaf) => ({ id: `leaf-${branch}-${leaf}`, name: `${leaf}`, stocks: [], children: [] })),
      })),
    };
    const first = layoutCanvasMindMap(large, 'leaf-5-5', { expandedId: 'branch-5', expandedWidth: 650, expandedHeight: 500 });
    expect(first).toEqual(layoutCanvasMindMap(large, 'leaf-5-5', { expandedId: 'branch-5', expandedWidth: 650, expandedHeight: 500 }));
    expect(first.nodes).toHaveLength(121);
    for (let i = 0; i < first.nodes.length; i += 1) {
      for (let j = i + 1; j < first.nodes.length; j += 1) expect(rectanglesOverlap(first.nodes[i], first.nodes[j])).toBe(false);
    }
  });
});
