import { describe, expect, it } from 'vitest';
import { layoutCanvasMindMap } from './canvasMindMap';
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
    expect(first.nodes.every((node) => node.x >= 0 && node.y >= 0 && node.x + node.width <= first.width && node.y + node.height <= first.height)).toBe(true);
  });
});
