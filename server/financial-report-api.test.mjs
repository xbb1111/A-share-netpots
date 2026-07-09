import { describe, expect, it } from 'vitest';
import {
  normalizeFilingType,
  pickRelatedForecast,
  searchSecurities,
} from './financial-report-api.mjs';

describe('financial-report-api helpers', () => {
  it('falls back to a visible code candidate when a valid code has no search hit', async () => {
    const fetcher = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ QuotationCodeTable: { Data: [] } }),
    });

    try {
      await expect(searchSecurities('603929')).resolves.toEqual([
        { code: '603929', name: '603929', industry: '公开搜索', exchange: 'SSE' },
      ]);
    } finally {
      globalThis.fetch = fetcher;
    }
  });

  it('classifies performance pre-disclosure as earnings preview', () => {
    expect(normalizeFilingType('2025年度业绩预披露公告')).toBe('earnings_preview');
    expect(normalizeFilingType('2025年前三季度业绩预告')).toBe('earnings_preview');
  });

  it('does not match stale forecast records from a different filing year', () => {
    expect(
      pickRelatedForecast(
        [{ REPORT_DATE: '2016-12-31 00:00:00', PREDICT_FINANCE: '归属于上市公司股东的净利润' }],
        { reportDate: '2026-07-08' },
      ),
    ).toBeNull();
  });
});
