import { describe, expect, it } from 'vitest';
import {
  calculateIndexMetrics,
  calculateIndexSeries,
  calculateTargetWeights,
  getWeightInputDisplayValue,
  prepareComponentsForWeightMethod,
  selectCoreComponents,
  validateIndexComponents,
  type CustomIndexConfig,
  type PriceHistory,
} from './customIndex';

const histories: PriceHistory = {
  AAA: [
    { date: '2026-01-02', open: 99, high: 101, low: 98, close: 100 },
    { date: '2026-01-05', open: 109, high: 112, low: 108, close: 110 },
    { date: '2026-02-02', close: 99 },
    { date: '2026-03-02', close: 99 },
  ],
  BBB: [
    { date: '2026-01-02', open: 99, high: 101, low: 98, close: 100 },
    { date: '2026-01-05', open: 99, high: 102, low: 97, close: 100 },
    { date: '2026-02-02', close: 110 },
    { date: '2026-03-02', close: 121 },
  ],
  CCC: [
    { date: '2026-01-02', open: 99, high: 101, low: 98, close: 100 },
    { date: '2026-01-05', open: 99, high: 101, low: 98, close: 100 },
    { date: '2026-02-02', close: 100 },
    { date: '2026-03-02', close: 100 },
  ],
};

const components = [
  { code: 'AAA', name: '甲', industry: '科技', targetWeight: 50 },
  { code: 'BBB', name: '乙', industry: '科技', targetWeight: 30 },
  { code: 'CCC', name: '丙', industry: '消费', targetWeight: 20 },
];

describe('custom index calculation', () => {
  it('normalizes custom weights and rejects invalid totals', () => {
    expect(calculateTargetWeights(components, 'custom')).toEqual({ AAA: 0.5, BBB: 0.3, CCC: 0.2 });
    expect(() => calculateTargetWeights(components.map((item) => ({ ...item, targetWeight: 40 })), 'custom')).toThrow(
      '权重合计必须为 100%',
    );
  });

  it('creates equal weights and market-cap weights', () => {
    expect(calculateTargetWeights(components, 'equal')).toEqual({ AAA: 1 / 3, BBB: 1 / 3, CCC: 1 / 3 });
    expect(
      calculateTargetWeights(
        components.map((item, index) => ({ ...item, marketCap: [100, 300, 600][index] })),
        'marketCap',
      ),
    ).toEqual({ AAA: 0.1, BBB: 0.3, CCC: 0.6 });
  });

  it('ignores stale manual input when switching to automatic weighting', () => {
    expect(getWeightInputDisplayValue(components, 'equal', 'BBB', '1126.96')).toBe('33.33');
    expect(
      getWeightInputDisplayValue(
        components.map((item, index) => ({ ...item, marketCap: [100, 300, 600][index] })),
        'marketCap',
        'BBB',
        '1126.96',
      ),
    ).toBe('30');
    expect(getWeightInputDisplayValue(components, 'custom', 'BBB', '29.5')).toBe('29.5');
  });

  it('copies automatic weights when switching back to custom weighting', () => {
    const marketCapComponents = components.map((item, index) => ({ ...item, marketCap: [100, 300, 600][index] }));
    expect(prepareComponentsForWeightMethod(marketCapComponents, 'marketCap', 'custom').map((item) => item.targetWeight)).toEqual([10, 30, 60]);
  });

  it('updates stored target weights when switching to an automatic method', () => {
    expect(prepareComponentsForWeightMethod(components, 'custom', 'equal').map((item) => item.targetWeight)).toEqual([33.33, 33.33, 33.34]);
    expect(
      prepareComponentsForWeightMethod(
        components.map((item, index) => ({ ...item, marketCap: [100, 300, 600][index] })),
        'custom',
        'marketCap',
      ).map((item) => item.targetWeight),
    ).toEqual([10, 30, 60]);
  });

  it('selects the five largest components by current weight', () => {
    const manyComponents = Array.from({ length: 7 }, (_, index) => ({ code: String(index), name: String(index), industry: '测试' }));
    const weights = { '0': 0.05, '1': 0.3, '2': 0.1, '3': 0.2, '4': 0.15, '5': 0.12, '6': 0.08 };
    expect(selectCoreComponents(manyComponents, weights).map((item) => item.code)).toEqual(['1', '3', '4', '5', '2']);
  });

  it('aligns dates and calculates a base-100 index', () => {
    const config: CustomIndexConfig = { components, weightMethod: 'custom', rebalanceFrequency: 'none' };
    const series = calculateIndexSeries(config, histories);

    expect(series.map((point) => point.date)).toEqual(['2026-01-02', '2026-01-05', '2026-02-02', '2026-03-02']);
    expect(series[0].value).toBe(100);
    expect(series[1].value).toBeCloseTo(105);
    expect(series[2].value).toBeCloseTo(102.5);
    expect(series[1].open).toBeCloseTo(104);
    expect(series[1].high).toBeGreaterThan(series[1].close);
    expect(series[1].low).toBeLessThan(series[1].close);
  });

  it('starts the index from the configured base date', () => {
    const series = calculateIndexSeries(
      { components, weightMethod: 'custom', rebalanceFrequency: 'none', baseDate: '2026-02-02' },
      histories,
    );

    expect(series[0].date).toBe('2026-02-02');
    expect(series[0].value).toBe(100);
  });

  it('changes results when monthly rebalancing is enabled', () => {
    const noRebalance = calculateIndexSeries(
      { components, weightMethod: 'custom', rebalanceFrequency: 'none' },
      histories,
    );
    const monthly = calculateIndexSeries(
      { components, weightMethod: 'custom', rebalanceFrequency: 'monthly' },
      histories,
    );

    expect(monthly.at(-1)?.value).not.toBeCloseTo(noRebalance.at(-1)?.value ?? 0);
  });

  it('calculates returns, volatility and drawdown metrics', () => {
    const series = calculateIndexSeries(
      { components, weightMethod: 'custom', rebalanceFrequency: 'none' },
      histories,
    );
    const metrics = calculateIndexMetrics(series);

    expect(metrics.totalReturn).toBeCloseTo(0.058);
    expect(metrics.maxDrawdown).toBeCloseTo(0.0238095);
    expect(metrics.annualizedVolatility).toBeGreaterThan(0);
  });

  it('reports duplicate components and missing history', () => {
    expect(() => validateIndexComponents([...components, components[0]])).toThrow('成分股不能重复');
    expect(() => calculateIndexSeries({ components, weightMethod: 'custom', rebalanceFrequency: 'none' }, { AAA: [] })).toThrow(
      '缺少成分股历史行情',
    );
  });
});
