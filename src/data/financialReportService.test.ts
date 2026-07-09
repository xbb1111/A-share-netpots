import { describe, expect, it } from 'vitest';
import {
  buildFinancialApiUrl,
  fetchFilingAnalysis,
  fetchFinancialFilings,
  fetchFinancialMetrics,
  searchReportSecurities,
} from './financialReportService';

describe('financialReportService', () => {
  it('builds same-origin API URLs by default and supports configured API hosts', () => {
    expect(buildFinancialApiUrl('/api/filings?code=300750')).toBe('/api/filings?code=300750');
    expect(buildFinancialApiUrl('/api/filings?code=300750', 'https://api.example.com')).toBe(
      'https://api.example.com/api/filings?code=300750',
    );
    expect(buildFinancialApiUrl('/api/filings?code=300750', undefined, 'xbb1111.github.io')).toBe(
      'https://a-share-financial-report-api.2561340168.workers.dev/api/filings?code=300750',
    );
  });

  it('searches securities through the financial report API', async () => {
    const requested: string[] = [];
    const fetcher = async (input: string) => {
      requested.push(input);
      return {
        ok: true,
        json: async () => ({
          securities: [{ code: '300750', name: '宁德时代', industry: '电力设备', exchange: 'SZSE' }],
        }),
      };
    };

    await expect(searchReportSecurities('宁德', fetcher)).resolves.toEqual([
      { code: '300750', name: '宁德时代', industry: '电力设备', exchange: 'SZSE' },
    ]);
    expect(requested[0]).toBe('/api/securities/search?q=%E5%AE%81%E5%BE%B7');
  });

  it('fetches relevant filings for a selected security', async () => {
    const requested: string[] = [];
    const fetcher = async (input: string) => {
      requested.push(input);
      return {
        ok: true,
        json: async () => ({
          filings: [
            {
              id: '2025-q3',
              title: '2025年第三季度报告',
              type: 'quarterly',
              reportDate: '2025-10-24',
              source: 'cninfo',
              url: 'https://example.com/q3.pdf',
            },
          ],
        }),
      };
    };

    const filings = await fetchFinancialFilings({ code: '300750', type: 'quarterly' }, fetcher);

    expect(requested[0]).toBe('/api/filings?code=300750&type=quarterly');
    expect(filings).toHaveLength(1);
    expect(filings[0].title).toBe('2025年第三季度报告');
  });

  it('posts a selected filing for analysis', async () => {
    const requests: Array<{ input: string; init?: RequestInit }> = [];
    const fetcher = async (input: string, init?: RequestInit) => {
      requests.push({ input, init });
      return {
        ok: true,
        json: async () => ({
          analysis: {
            security: { code: '300750', name: '宁德时代', industry: '电力设备', exchange: 'SZSE' },
            filing: {
              id: '2025-q3',
              title: '2025年第三季度报告',
              type: 'quarterly',
              reportDate: '2025-10-24',
              source: 'cninfo',
              url: 'https://example.com/q3.pdf',
            },
            verdict: 'above',
            score: 88,
            expectationGap: { basis: 'forecast_net_profit', percent: 4.2, label: '归母净利润较公开盈利预测+4.20%' },
            bullishDrivers: ['归母净利润高于公开盈利预测'],
            riskFlags: [],
            industryChecklist: ['经营现金流是否覆盖利润'],
            summary: '宁德时代2025Q3 整体超预期。',
          },
        }),
      };
    };

    const analysis = await fetchFilingAnalysis({ code: '300750', filingId: '2025-q3' }, fetcher);

    expect(requests[0].input).toBe('/api/filings/analyze');
    expect(requests[0].init?.method).toBe('POST');
    expect(requests[0].init?.body).toBe(JSON.stringify({ code: '300750', filingId: '2025-q3' }));
    expect(analysis.verdict).toBe('above');
  });

  it('throws a user-facing error when the API is unavailable', async () => {
    const fetcher = async () => ({
      ok: false,
      json: async () => ({ message: 'upstream failed' }),
    });

    await expect(fetchFinancialFilings({ code: '300750' }, fetcher)).rejects.toThrow('财报分析服务暂不可用：upstream failed');
  });

  it('fetches financial metrics with optional peer comparison', async () => {
    const requested: string[] = [];
    const fetcher = async (input: string) => {
      requested.push(input);
      return {
        ok: true,
        json: async () => ({
          security: { code: '300750', name: '宁德时代', industry: '电池', exchange: 'SZSE' },
          metricCatalog: [{ id: 'netProfit', label: '归母净利润', unit: '元', category: '成长', chartType: 'bar' }],
          periods: ['2026一季报'],
          series: { netProfit: [{ period: '2026一季报', reportDate: '2026-03-31', value: 20737710000, yoy: 48.52, qoq: 9.38 }] },
          peers: [],
          industryBenchmark: { netProfit: [{ period: '2026一季报', median: null, max: null, min: null }] },
        }),
      };
    };

    const metrics = await fetchFinancialMetrics({ code: '300750', period: 'quarterly', includePeers: true, peerCount: 5 }, fetcher);

    expect(requested[0]).toBe('/api/financial-metrics?code=300750&period=quarterly&includePeers=true&peerCount=5');
    expect(metrics.series.netProfit[0].yoy).toBe(48.52);
  });


  it('explains that GitHub Pages needs a deployed API when the endpoint is missing', async () => {
    const fetcher = async () => ({
      ok: false,
      json: async () => ({}),
    });

    await expect(fetchFinancialFilings({ code: '300750' }, fetcher)).rejects.toThrow(
      '线上静态页面未连接财报分析 API',
    );
  });
});
