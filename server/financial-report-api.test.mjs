import { describe, expect, it } from 'vitest';
import {
  handleFinancialReportRequest,
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

  it('matches the same filing period and prefers net profit guidance over deducted net profit', () => {
    const q1Forecast = {
      REPORT_DATE: '2026-03-31 00:00:00',
      PREDICT_FINANCE_CODE: '004',
      PREDICT_FINANCE: '归属于上市公司股东的净利润',
      FORECAST_JZ: 247500000,
    };
    const halfYearDeductedForecast = {
      REPORT_DATE: '2026-06-30 00:00:00',
      PREDICT_FINANCE_CODE: '005',
      PREDICT_FINANCE: '扣除非经常性损益后的净利润',
      FORECAST_JZ: 490000000,
    };
    const halfYearNetProfitForecast = {
      REPORT_DATE: '2026-06-30 00:00:00',
      PREDICT_FINANCE_CODE: '004',
      PREDICT_FINANCE: '归属于上市公司股东的净利润',
      FORECAST_JZ: 490500000,
    };

    expect(
      pickRelatedForecast(
        [q1Forecast, halfYearDeductedForecast, halfYearNetProfitForecast],
        { reportDate: '2026-07-08', title: '2026年半年度业绩预告' },
      ),
    ).toBe(halfYearNetProfitForecast);
  });

  it('handles CORS preflight with the shared fetch entrypoint', async () => {
    const response = await handleFinancialReportRequest(new Request('https://api.example.com/api/filings', { method: 'OPTIONS' }));

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET,POST,OPTIONS');
  });

  it('handles security search through the shared fetch entrypoint', async () => {
    const fetcher = globalThis.fetch;
    globalThis.fetch = async () => ({
      ok: true,
      json: async () => ({ QuotationCodeTable: { Data: [{ Code: '603929', Name: '亚翔集成' }] } }),
    });

    try {
      const response = await handleFinancialReportRequest(new Request('https://api.example.com/api/securities/search?q=603929'));
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.securities[0]).toEqual({ code: '603929', name: '亚翔集成', industry: '公开搜索', exchange: 'SSE' });
    } finally {
      globalThis.fetch = fetcher;
    }
  });

  it('loads filings by report categories and filters exact stock codes', async () => {
    const fetcher = globalThis.fetch;
    const requestedBodies = [];

    globalThis.fetch = async (input, init) => {
      const url = String(input);

      if (url.includes('searchapi.eastmoney.com')) {
        return {
          ok: true,
          json: async () => ({ QuotationCodeTable: { Data: [{ Code: '000001', Name: '平安银行' }] } }),
        };
      }

      requestedBodies.push(String(init?.body ?? ''));

      return {
        ok: true,
        json: async () => ({
          announcements: [
            {
              secCode: '601318',
              announcementId: 'wrong-owner',
              announcementTitle: '中国平安：平安银行股份有限公司2025年年度报告摘要',
              announcementTime: Date.parse('2026-03-20T00:00:00Z'),
              adjunctUrl: 'wrong.pdf',
            },
            {
              secCode: '000001',
              announcementId: 'bank-annual',
              announcementTitle: '平安银行2025年年度报告',
              announcementTime: Date.parse('2026-03-14T00:00:00Z'),
              adjunctUrl: 'bank.pdf',
            },
          ],
        }),
      };
    };

    try {
      const response = await handleFinancialReportRequest(new Request('https://api.example.com/api/filings?code=000001'));
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(requestedBodies.some((body) => body.includes('category_ndbg_szsh'))).toBe(true);
      expect(requestedBodies.some((body) => body.includes(encodeURIComponent('平安银行')))).toBe(true);
      expect(payload.filings).toHaveLength(1);
      expect(payload.filings[0].id).toBe('bank-annual');
      expect(payload.filings[0].title).toBe('平安银行2025年年度报告');
    } finally {
      globalThis.fetch = fetcher;
    }
  });
});
