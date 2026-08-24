import { describe, expect, it } from 'vitest';
import { clampSentimentRange, fetchSentimentSnapshot } from './sentimentService';

describe('sentiment service', () => {
  it('requests a manual refresh and accepts exactly six metrics', async () => {
    const urls: string[] = [];
    const metrics = Array.from({ length: 6 }, (_, index) => ({ id: String(index), series: [] }));
    const result = await fetchSentimentSnapshot(true, async (url) => {
      urls.push(url);
      return { ok: true, json: async () => ({ commonAsOf: '2026-08-21', updatedAt: 'now', stale: false, methodology: 'test', metrics }) };
    });
    expect(urls[0]).toContain('/api/market-sentiment?refresh=1');
    expect(result.metrics).toHaveLength(6);
  });

  it('keeps a minimum twenty-day global chart window', () => {
    expect(clampSentimentRange(90, 95, 100, 'start')).toEqual({ start: 76, end: 95 });
    expect(clampSentimentRange(10, 12, 100, 'end')).toEqual({ start: 10, end: 29 });
  });
});
