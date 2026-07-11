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
});
