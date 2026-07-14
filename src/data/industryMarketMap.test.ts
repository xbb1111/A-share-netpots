import { describe, expect, it } from 'vitest';
import { buildIndustryMarketMap } from './industryMarketMap';

const boards = [
  { code: 'ROOT-A', name: '信息技术', level: 1 as const, heat: 80, change: 0, capitalFlow: 2 },
  { code: 'A1', name: '半导体', level: 2 as const, parentCode: 'ROOT-A', heat: 100, change: 1, capitalFlow: 8 },
  { code: 'A2', name: '软件开发', level: 2 as const, parentCode: 'ROOT-A', heat: 50, change: -1, capitalFlow: -3 },
  { code: 'B1', name: '银行', level: 2 as const, heat: 30, change: 3, capitalFlow: 1 },
  { code: 'X1', name: '未知门类', level: 2 as const, heat: 10, change: 0, capitalFlow: 0 },
];

describe('industry market constellation layout', () => {
  it('is deterministic and assigns boards to stable primary groups', () => {
    const layout = buildIndustryMarketMap(boards, 'heat', 900, 520);
    expect(layout).toEqual(buildIndustryMarketMap(boards, 'heat', 900, 520));
    expect(layout.items.find((item) => item.code === 'A1')?.groupId).toBe('ROOT-A');
    expect(layout.items.find((item) => item.code === 'B1')?.groupName).toBe('金融');
    expect(layout.items.find((item) => item.code === 'X1')?.groupName).toBe('其他');
  });

  it('keeps every cell inside its bounds without obvious overlap', () => {
    const layout = buildIndustryMarketMap(boards, 'heat', 900, 520);
    for (const item of layout.items) {
      expect(item.x - item.r).toBeGreaterThanOrEqual(0);
      expect(item.y - item.r).toBeGreaterThanOrEqual(0);
      expect(item.x + item.r).toBeLessThanOrEqual(layout.bounds.width);
      expect(item.y + item.r).toBeLessThanOrEqual(layout.bounds.height);
    }
    for (let index = 0; index < layout.items.length; index += 1) for (let other = index + 1; other < layout.items.length; other += 1) {
      const a = layout.items[index]; const b = layout.items[other];
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r - 0.01);
    }
  });

  it('uses only the selected metric for area and absolute change for gain/loss', () => {
    const layout = buildIndustryMarketMap(boards, 'change', 900, 520);
    const gain = layout.items.find((item) => item.code === 'A1')!;
    const loss = layout.items.find((item) => item.code === 'A2')!;
    expect(gain.r).toBeCloseTo(loss.r, 8);
    expect(gain.tone).toBe('up');
    expect(loss.tone).toBe('down');
    expect(layout.items.find((item) => item.code === 'ROOT-A')?.tone).toBe('flat');
  });

  it('forms an organic arrangement rather than a regular grid', () => {
    const layout = buildIndustryMarketMap(boards, 'heat', 900, 520);
    expect(new Set(layout.items.map((item) => item.x.toFixed(2))).size).toBeGreaterThan(2);
    expect(new Set(layout.items.map((item) => item.y.toFixed(2))).size).toBeGreaterThan(2);
    expect(layout.groups.every((group) => group.width > 0 && group.height > 0)).toBe(true);
  });

  it('keeps a dense primary group collision free', () => {
    const dense = Array.from({ length: 80 }, (_, index) => ({ code: `T${index}`, name: `软件${index}`, level: 2 as const, heat: 100 - index, change: index % 2 ? -1 : 1, capitalFlow: 0 }));
    const layout = buildIndustryMarketMap(dense, 'heat', 920, 750);
    for (let index = 0; index < layout.items.length; index += 1) for (let other = index + 1; other < layout.items.length; other += 1) {
      const a = layout.items[index]; const b = layout.items[other];
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r - 0.01);
    }
  });
});
