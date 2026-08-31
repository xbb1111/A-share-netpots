import { describe, expect, it } from 'vitest';
import { aggregateCffexDay, buildLargeCapitalSnapshot, normalizeMemberName, parseCffexCsv } from './large-capital-metrics.mjs';

describe('large capital metrics', () => {
  it('parses CFFEX rows and normalizes agency suffixes', () => {
    const csv = [
      '交易日,合约,排名,成交量排名,,,持买单量排名,,,持卖单量排名,,',
      ',,,会员简称,成交量,比上一交易日增减,会员简称,持买单量,比上一交易日增减,会员简称,持卖单量,比上一交易日增减',
      '20260401,IF2604,1,中信期货(代客),100,2,国泰君安（代客）,80,3,中信期货(代客),70,-4',
      '20260401,IF2606,1,国泰君安(代客),90,1,国泰君安(代客),20,2,华泰期货(代客),40,5',
    ].join('\n');
    const rows = parseCffexCsv(csv, 'IF');
    expect(rows).toHaveLength(2);
    expect(normalizeMemberName('中信期货（代客）')).toBe('中信期货');
    const result = aggregateCffexDay(rows, 'IF', '2026-04-01');
    expect(result.tiers.top20).toMatchObject({ long: 100, short: 110, net: -10 });
    expect(result.members.find((item) => item.name === '国泰君安')).toMatchObject({ long: 100, short: 0, net: 100, hasShort: false, qualityFlags: ['short-not-in-disclosed-ranking'] });
  });

  it('does not misread a NAV drop with unchanged shares as redemption and filters split suspects', () => {
    const snapshot = buildLargeCapitalSnapshot({
      generatedAt: '2026-04-03T10:00:00.000Z',
      etfs: [{ code: '510300', series: [
        { date: '2026-04-01', nav: 4, shares: 100_000_000, amount: 1_000_000 },
        { date: '2026-04-02', nav: 3.8, shares: 100_000_000, amount: 1_100_000 },
        { date: '2026-04-03', nav: 1.9, shares: 200_000_000, amount: 1_200_000 },
      ] }],
      benchmarks: [{ id: 'csi300', series: [{ date: '2026-04-01', close: 4000 }, { date: '2026-04-02', close: 4040 }] }],
      institutionDays: [],
    });
    const series = snapshot.nationalTeam.etfs[0].series;
    expect(series[1].netFlowYi).toBe(0);
    expect(series[2].netFlowYi).toBeNull();
    expect(series[2].qualityFlags).toContain('split-suspect');
    expect(snapshot.benchmarks[0]).toMatchObject({ id: 'csi300', name: '沪深300', code: '000300' });
  });

  it('caps ETF/product history at 252 days and member history at 120 days', () => {
    const dates = Array.from({ length: 280 }, (_, index) => `2025-${String(Math.floor(index / 28) + 1).padStart(2, '0')}-${String(index % 28 + 1).padStart(2, '0')}`);
    const institutionDays = dates.map((date) => aggregateCffexDay([{ rank: 1, contract: 'IF9999', longMember: '甲席位', long: 10, longChange: 1, shortMember: '乙席位', short: 9, shortChange: 0 }], 'IF', date));
    const snapshot = buildLargeCapitalSnapshot({ generatedAt: '2026-12-31T00:00:00.000Z', etfs: [{ code: '510300', series: dates.map((date, index) => ({ date, nav: 1, shares: 100 + index, amount: 1 })) }], benchmarks: [{ id: 'csi300', series: dates.map((date, index) => ({ date, close: 4000 + index })) }], institutionDays });
    expect(snapshot.nationalTeam.etfs[0].series).toHaveLength(252);
    expect(snapshot.institutions.products[0].summarySeries).toHaveLength(252);
    expect(snapshot.institutions.products[0].members[0].history).toHaveLength(120);
    expect(snapshot.benchmarks[0].series).toHaveLength(252);
    expect(snapshot.institutions.products[0].benchmarkId).toBe('csi300');
  });
});
