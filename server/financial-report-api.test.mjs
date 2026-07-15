import { describe, expect, it } from 'vitest';
import {
  handleFinancialReportRequest,
  normalizeFilingType,
  summarizeScoreBreakdown,
  pickRelatedForecast,
  pickRelatedFinanceReport,
  searchSecurities,
} from './financial-report-api.mjs';

describe('financial-report-api helpers', () => {
  it('falls back to Tencent daily K-lines after Eastmoney retries fail', async () => {
    const fetcher = globalThis.fetch;
    const hosts = [];
    globalThis.fetch = async (url) => {
      const host = new URL(String(url)).hostname;
      hosts.push(host);
      if (host === 'push2his.eastmoney.com') return { ok: false, status: 520, text: async () => 'upstream unavailable' };
      return { ok: true, json: async () => ({ code: 0, data: { sz300750: { qfqday: [['2026-07-15', '368.01', '373.00', '379.99', '363.08', '358493']], qt: { sz300750: ['51', '宁德时代'] } } } }) };
    };
    try {
      const response = await handleFinancialReportRequest(new Request('https://api.example.com/api/market-kline?code=300750&klt=101&limit=5'));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ data: { code: '300750', name: '宁德时代', klines: ['2026-07-15,368.01,373.00,379.99,363.08,358493,0,0'] } });
      expect(hosts).toEqual(['push2his.eastmoney.com', 'push2his.eastmoney.com', 'web.ifzq.gtimg.cn']);
    } finally {
      globalThis.fetch = fetcher;
    }
  });

  it('falls back to the delayed quote host for security metrics', async () => {
    const fetcher = globalThis.fetch;
    const hosts = [];
    globalThis.fetch = async (url) => {
      hosts.push(new URL(String(url)).hostname);
      if (hosts.length === 1) return { ok: false, status: 502, text: async () => 'upstream unavailable' };
      return { ok: true, json: async () => ({ data: { f43: 37300, f162: 2080, f116: 1725740771153, f170: 247 } }) };
    };
    try {
      const response = await handleFinancialReportRequest(new Request('https://api.example.com/api/security-metrics?code=300750'));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ data: { f43: 37300, f116: 1725740771153 } });
      expect(hosts).toEqual(['push2.eastmoney.com', 'push2delay.eastmoney.com']);
    } finally {
      globalThis.fetch = fetcher;
    }
  });

  it('proxies and normalizes an industry board constituent response', async () => {
    const fetcher = globalThis.fetch;
    globalThis.fetch = async (url) => {
      expect(String(url)).toContain('push2delay.eastmoney.com');
      expect(String(url)).toContain('fs=b%3ABK1303');
      return { ok: true, json: async () => ({ data: { diff: [
        { f12: '300750', f14: '宁德时代', f2: 218.6, f3: 2.41, f62: 920000000, f20: 987000000000, f100: '电池' },
      ] } }) };
    };
    try {
      const response = await handleFinancialReportRequest(new Request('https://api.example.com/api/industry-companies?boardCode=BK1303'));
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ companies: [{ code: '300750', name: '宁德时代', capitalFlow: 9.2 }] });
    } finally {
      globalThis.fetch = fetcher;
    }
  });

  it('loads every constituent page for large industry boards', async () => {
    const fetcher = globalThis.fetch;
    const urls = [];
    globalThis.fetch = async (url) => {
      urls.push(String(url));
      const page = Number(new URL(url).searchParams.get('pn'));
      const count = page === 1 ? 100 : 1;
      return { ok: true, json: async () => ({ data: { diff: Array.from({ length: count }, (_, index) => ({ f12: `${page}${String(index).padStart(5, '0')}`, f14: `公司${page}-${index}`, f2: 10, f3: 0, f62: 0, f20: 100000000, f100: '测试行业' })) } }) };
    };
    try {
      const response = await handleFinancialReportRequest(new Request('https://api.example.com/api/industry-companies?boardCode=BK1303'));
      const payload = await response.json();
      expect(payload.companies).toHaveLength(101);
      expect(urls).toHaveLength(2);
    } finally {
      globalThis.fetch = fetcher;
    }
  });

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

  it('returns quarterly financial metric series without loading peers by default', async () => {
    const fetcher = globalThis.fetch;
    const requestedUrls = [];

    globalThis.fetch = async (input) => {
      const url = String(input);
      requestedUrls.push(url);

      if (url.includes('searchapi.eastmoney.com')) {
        return {
          ok: true,
          json: async () => ({ QuotationCodeTable: { Data: [{ Code: '300750', Name: '宁德时代' }] } }),
        };
      }

      if (url.includes('RPT_F10_FINANCE_MAINFINADATA')) {
        return {
          ok: true,
          json: async () => ({
            result: {
              data: [
                {
                  SECURITY_CODE: '300750',
                  SECURITY_NAME_ABBR: '宁德时代',
                  REPORT_DATE: '2026-03-31 00:00:00',
                  REPORT_DATE_NAME: '2026一季报',
                  REPORT_TYPE: '一季报',
                  TOTALOPERATEREVE: 129131041000,
                  TOTALOPERATEREVETZ: 52.45,
                  YYZSRGDHBZC: 10.49,
                  PARENTNETPROFIT: 20737710000,
                  PARENTNETPROFITTZ: 48.52,
                  NETPROFITRPHBZC: 9.38,
                  KCFJCXSYJLR: 18092637000,
                  KCFJCXSYJLRTZ: 52.95,
                  XSMLL: 24.41,
                  XSJLL: 16.06,
                  ROEJQ: 5.98,
                  JYXJLYYSR: 25.49,
                  MGJYXJJE: 7.38,
                },
                {
                  SECURITY_CODE: '300750',
                  SECURITY_NAME_ABBR: '宁德时代',
                  REPORT_DATE: '2025-12-31 00:00:00',
                  REPORT_DATE_NAME: '2025年报',
                  REPORT_TYPE: '年报',
                  TOTALOPERATEREVE: 420000000000,
                  PARENTNETPROFIT: 65000000000,
                },
              ],
            },
          }),
        };
      }

      if (url.includes('RPT_DMSK_FN_BALANCE')) {
        return {
          ok: true,
          json: async () => ({
            result: {
              data: [
                {
                  REPORT_DATE: '2026-03-31 00:00:00',
                  DEBT_ASSET_RATIO: 62.1,
                  MONETARYFUNDS: 320000000000,
                  ACCOUNTS_RECE: 76000000000,
                  INVENTORY: 94000000000,
                },
              ],
            },
          }),
        };
      }

      if (url.includes('RPT_DMSK_FN_CASHFLOW')) {
        return {
          ok: true,
          json: async () => ({
            result: {
              data: [{ REPORT_DATE: '2026-03-31 00:00:00', NETCASH_OPERATE: 32868257000 }],
            },
          }),
        };
      }

      throw new Error(`unexpected request ${url}`);
    };

    try {
      const response = await handleFinancialReportRequest(
        new Request('https://api.example.com/api/financial-metrics?code=300750&period=quarterly'),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.security).toEqual({ code: '300750', name: '宁德时代', industry: '公开搜索', exchange: 'SZSE' });
      expect(payload.periods).toEqual(['2026一季报']);
      expect(payload.metricCatalog.find((item) => item.id === 'netProfit')?.category).toBe('成长');
      expect(payload.series.netProfit[0]).toMatchObject({
        period: '2026一季报',
        value: 20737710000,
        yoy: 48.52,
        qoq: 9.38,
      });
      expect(payload.series.debtAssetRatio[0].value).toBe(62.1);
      expect(payload.peers).toEqual([]);
      expect(requestedUrls.some((url) => url.includes('push2.eastmoney.com'))).toBe(false);
    } finally {
      globalThis.fetch = fetcher;
    }
  });

  it('returns annual financial metric series and limits peer comparison to five companies', async () => {
    const fetcher = globalThis.fetch;

    globalThis.fetch = async (input) => {
      const url = String(input);

      if (url.includes('searchapi.eastmoney.com')) {
        return {
          ok: true,
          json: async () => ({ QuotationCodeTable: { Data: [{ Code: '300750', Name: '宁德时代' }] } }),
        };
      }

      if (url.includes('push2.eastmoney.com')) {
        return {
          ok: true,
          json: async () => ({
            data: {
              diff: [
                { f12: '300750', f14: '宁德时代', f20: 1000, f100: '电池' },
                { f12: '300014', f14: '亿纬锂能', f20: 900, f100: '电池' },
                { f12: '002812', f14: '恩捷股份', f20: 800, f100: '电池' },
                { f12: '002709', f14: '天赐材料', f20: 700, f100: '电池' },
                { f12: '002074', f14: '国轩高科', f20: 600, f100: '电池' },
                { f12: '300207', f14: '欣旺达', f20: 500, f100: '电池' },
                { f12: '688005', f14: '容百科技', f20: 400, f100: '电池' },
              ],
            },
          }),
        };
      }

      const code = url.match(/SECURITY_CODE="(\d{6})"/)?.[1] ?? '300750';

      if (url.includes('RPT_F10_FINANCE_MAINFINADATA')) {
        return {
          ok: true,
          json: async () => ({
            result: {
              data: [
                {
                  SECURITY_CODE: code,
                  SECURITY_NAME_ABBR: code,
                  REPORT_DATE: '2025-12-31 00:00:00',
                  REPORT_DATE_NAME: '2025年报',
                  REPORT_TYPE: '年报',
                  TOTALOPERATEREVE: Number(code.slice(-2)) * 100000000,
                  TOTALOPERATEREVETZ: Number(code.slice(-2)),
                  PARENTNETPROFIT: Number(code.slice(-2)) * 10000000,
                  PARENTNETPROFITTZ: Number(code.slice(-2)) / 2,
                },
              ],
            },
          }),
        };
      }

      return { ok: true, json: async () => ({ result: { data: [] } }) };
    };

    try {
      const response = await handleFinancialReportRequest(
        new Request('https://api.example.com/api/financial-metrics?code=300750&period=annual&includePeers=true&peerCount=5'),
      );
      const payload = await response.json();

      expect(response.status).toBe(200);
      expect(payload.periods).toEqual(['2025年报']);
      expect(payload.peers).toHaveLength(5);
      expect(payload.peers.map((peer) => peer.security.code)).not.toContain('300750');
      expect(payload.industryBenchmark.netProfit[0]).toMatchObject({
        period: '2025年报',
      });
      expect(payload.industryBenchmark.netProfit[0].median).toBeGreaterThan(0);
    } finally {
      globalThis.fetch = fetcher;
    }
  });

  it('summarizes the scoring formula consistently with final score', () => {
    const componentScores = [
      { id: 'source', label: '公告来源可信度', score: 90, status: 'positive', data: [] },
      { id: 'growth', label: '营收与利润增长', score: 82, status: 'positive', data: [] },
      { id: 'quality', label: '利润质量', score: 70, status: 'neutral', data: [] },
      { id: 'cashflow', label: '现金流质量', score: 58, status: 'neutral', data: [] },
    ];

    expect(summarizeScoreBreakdown(componentScores, [])).toMatchObject({
      formula: '综合评分 = 分项均值 - 缺失项惩罚 - 高风险惩罚',
      componentAverage: 75,
      missingPenalty: 0,
      highRiskPenalty: 0,
      finalScore: 75,
    });
  });
});
