import { describe, expect, it } from 'vitest';
import { buildSentimentPayload, emotionPercentile, getEmotionZone, mergeSentimentRows, percentileRank } from './sentiment-metrics.mjs';

describe('sentiment metrics', () => {
  it('calculates percentile ranks and reverses ERP emotion direction', () => {
    expect(percentileRank([1, 2, 3, 4], 3)).toBe(75);
    expect(emotionPercentile('erp', [1, 2, 3, 4], 3)).toBe(25);
  });

  it('uses the report five-zone boundaries', () => {
    expect([19.9, 20, 40, 60, 80].map(getEmotionZone)).toEqual(['极度恐慌', '偏冷', '中性', '偏热', '极度贪婪']);
  });

  it('keeps six metrics independent and limits history to 252 days', () => {
    const rows = Array.from({ length: 260 }, (_, index) => ({
      date: `2026-${String(Math.floor(index / 28) + 1).padStart(2, '0')}-${String((index % 28) + 1).padStart(2, '0')}`,
      turnover: index + 1,
      top3IndustryShare: index + 2,
      top3Industries: [{ name: '电子', amountYi: 100, share: 10 }],
      totalAmountYi: 1000,
      risingShare: index + 3,
      rising0To5Share: 20,
      rising5To10Share: 5,
      risingAbove10Share: 1,
      aboveMa20Share: index + 4,
      marginBuyShare: index + 5,
      erp: index + 6,
    }));
    const payload = buildSentimentPayload(rows, { updatedAt: '2026-08-24T00:00:00.000Z' });
    expect(payload.metrics).toHaveLength(6);
    expect(payload.metrics.every((metric) => metric.series.length === 252)).toBe(true);
    expect(payload.metrics.find((metric) => metric.id === 'top3IndustryShare').series.at(-1).top3Industries[0].name).toBe('电子');
    expect(payload.metrics.find((metric) => metric.id === 'risingShare').series.at(-1).rising5To10Share).toBe(5);
    expect(payload).not.toHaveProperty('score');
  });

  it('replaces an existing date instead of duplicating it', () => {
    expect(mergeSentimentRows([{ date: '2026-08-21', turnover: 1 }], { date: '2026-08-21', turnover: 2 }))
      .toEqual([{ date: '2026-08-21', turnover: 2 }]);
  });
});
