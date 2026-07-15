import { describe, expect, it } from 'vitest';
import { buildIndustryMarketMap, buildIndustryMarketMapWithStats } from './industryMarketMap';

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

  it('maps equal heat to equal area across groups with different densities', () => {
    const crossGroup = [
      { code: 'R1', name: '技术', level: 1 as const, heat: 40, change: 0 },
      ...Array.from({ length: 12 }, (_, index) => ({ code: `A${index}`, name: `软件${index}`, level: 2 as const, parentCode: 'R1', heat: index === 0 ? 55 : index + 1, change: 0 })),
      { code: 'BANK', name: '银行', level: 2 as const, heat: 55, change: 0 },
    ];
    const layout = buildIndustryMarketMap(crossGroup, 'heat', 800, 360);
    expect(layout.items.find((item) => item.code === 'A0')?.r).toBeCloseTo(layout.items.find((item) => item.code === 'BANK')!.r, 8);
  });

  it('maps equal absolute change to equal area across groups', () => {
    const layout = buildIndustryMarketMap([
      { code: 'SOFT', name: '软件开发', level: 2 as const, heat: 1, change: 1 },
      { code: 'BANK', name: '银行', level: 2 as const, heat: 99, change: -1 },
    ], 'change', 800, 360);
    expect(layout.items[0].r).toBeCloseTo(layout.items[1].r, 8);
  });

  it('uses a readable minimum cell radius and expands short viewports when needed', () => {
    const dense = Array.from({ length: 80 }, (_, index) => ({ code: `S${index}`, name: `软件${index}`, level: 2 as const, heat: 0, change: 0 }));
    const layout = buildIndustryMarketMap(dense, 'heat', 640, 360);
    expect(Math.min(...layout.items.map((item) => item.r))).toBeGreaterThan(0);
    expect(layout.bounds.height).toBeGreaterThanOrEqual(360);
  });

  it('marks featured cells from the currently selected metric', () => {
    const metricBoards = [
      { code: 'HOT', name: '软件', level: 2 as const, heat: 100, change: 0.1 },
      { code: 'MOVE', name: '银行', level: 2 as const, heat: 1, change: -8 },
      { code: 'MID', name: '医药', level: 2 as const, heat: 50, change: 2 },
      { code: 'LOW', name: '煤炭', level: 2 as const, heat: 2, change: 1 },
    ];
    expect(buildIndustryMarketMap(metricBoards, 'heat', 800, 440).items.find((item) => item.code === 'HOT')?.featured).toBe(true);
    expect(buildIndustryMarketMap(metricBoards, 'change', 800, 440).items.find((item) => item.code === 'HOT')?.featured).toBe(false);
    expect(buildIndustryMarketMap(metricBoards, 'change', 800, 440).items.find((item) => item.code === 'MOVE')?.featured).toBe(true);
  });

  it('packs 400+ cells without overlaps using bounded candidate checks', () => {
    const dense = Array.from({ length: 420 }, (_, index) => ({ code: `P${index.toString().padStart(4, '0')}`, name: `软件${index}`, level: 2 as const, heat: 500 - index, change: index % 3 - 1 }));
    const { map, candidateChecks } = buildIndustryMarketMapWithStats(dense, 'heat', 1200, 800);
    expect(candidateChecks).toBeLessThan(420 * 8000);
    for (let index = 0; index < map.items.length; index += 1) for (let other = index + 1; other < map.items.length; other += 1) {
      const a = map.items[index]; const b = map.items[other];
      expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.r + b.r - 0.01);
    }
  });
});
