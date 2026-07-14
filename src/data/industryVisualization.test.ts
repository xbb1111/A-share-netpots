import { describe, expect, it } from 'vitest';
import { buildIndustryBubbles, getIndustryBubbleBounds } from './industryVisualization';

describe('industry bubble layout', () => {
  const boards = [
    { code: 'A', name: 'A', heat: 100, change: 5 },
    { code: 'B', name: 'B', heat: 50, change: -2 },
    { code: 'C', name: 'C', heat: 10, change: 0 },
  ];
  it('is deterministic, non-overlapping, and sizes circles by the selected metric', () => {
    const heat = buildIndustryBubbles(boards, 'heat', 500, 300);
    expect(heat).toEqual(buildIndustryBubbles(boards, 'heat', 500, 300));
    expect(heat[0].r).toBeGreaterThan(heat[1].r);
    for (let index = 0; index < heat.length; index += 1) for (let other = index + 1; other < heat.length; other += 1) {
      expect(Math.hypot(heat[index].x - heat[other].x, heat[index].y - heat[other].y)).toBeGreaterThanOrEqual(heat[index].r + heat[other].r);
    }
    expect(heat.find((item) => item.code === 'B')?.tone).toBe('down');
  });

  it('uses a compact, non-grid arrangement for a varied market map', () => {
    const variedBoards = Array.from({ length: 10 }, (_, index) => ({
      code: `B${index}`,
      heat: 100 - index * 7,
      change: index % 2 === 0 ? index + 1 : -(index + 1),
    }));
    const layout = buildIndustryBubbles(variedBoards, 'heat', 720, 440);

    expect(layout).toEqual(buildIndustryBubbles(variedBoards, 'heat', 720, 440));
    expect(layout[0].r).toBeGreaterThan(layout[layout.length - 1].r);
    expect(new Set(layout.map((bubble) => bubble.y.toFixed(3))).size).toBeGreaterThan(3);
    expect(new Set(layout.map((bubble) => bubble.x.toFixed(3))).size).toBeGreaterThan(3);
    for (let index = 0; index < layout.length; index += 1) for (let other = index + 1; other < layout.length; other += 1) {
      expect(Math.hypot(layout[index].x - layout[other].x, layout[index].y - layout[other].y)).toBeGreaterThanOrEqual(layout[index].r + layout[other].r);
    }
  });

  it('sizes gain and loss bubbles by absolute change only and reports enclosing bounds', () => {
    const layout = buildIndustryBubbles([
      { code: 'GAIN', heat: 10, change: 1 },
      { code: 'LOSS', heat: 90, change: -1 },
      { code: 'LARGE', heat: 1, change: 4 },
    ], 'change', 600, 360);
    const bounds = getIndustryBubbleBounds(layout);

    expect(layout.find((bubble) => bubble.code === 'GAIN')?.r).toBe(layout.find((bubble) => bubble.code === 'LOSS')?.r);
    expect(layout.find((bubble) => bubble.code === 'LARGE')?.r).toBeGreaterThan(layout.find((bubble) => bubble.code === 'GAIN')!.r);
    for (const bubble of layout) {
      expect(bubble.x - bubble.r).toBeGreaterThanOrEqual(0);
      expect(bubble.y - bubble.r).toBeGreaterThanOrEqual(0);
      expect(bubble.x + bubble.r).toBeLessThanOrEqual(bounds.width);
      expect(bubble.y + bubble.r).toBeLessThanOrEqual(bounds.height);
    }
  });
});
