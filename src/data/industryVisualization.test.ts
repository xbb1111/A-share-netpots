import { describe, expect, it } from 'vitest';
import { buildIndustryBubbles } from './industryVisualization';

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
});
