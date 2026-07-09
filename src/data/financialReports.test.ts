import { describe, expect, it } from 'vitest';
import {
  analyzeFinancialReport,
  filterRelevantFilings,
  normalizeFilingType,
  rankFilingAnalyses,
  type FinancialReportInput,
} from './financialReports';

const baseReport: FinancialReportInput = {
  security: { code: '300750', name: '宁德时代', industry: '电力设备', exchange: 'SZSE' },
  filing: {
    id: 'filing-2025q3',
    title: '2025年第三季度报告',
    type: 'quarterly',
    reportDate: '2025-10-24',
    source: 'cninfo',
    url: 'https://example.com/report.pdf',
  },
  financials: {
    period: '2025Q3',
    revenue: 283000000000,
    revenueYoY: 18.4,
    netProfit: 50700000000,
    netProfitYoY: 31.2,
    deductedNetProfit: 48900000000,
    deductedNetProfitYoY: 29.6,
    grossMargin: 24.8,
    grossMarginYoYDelta: 1.9,
    operatingCashFlow: 52100000000,
    operatingCashFlowYoY: 28.1,
    roe: 18.6,
    debtAssetRatio: 56.2,
    accountsReceivableYoY: 10.5,
    inventoryYoY: 12.8,
    sellingExpenseRatio: 3.2,
    managementExpenseRatio: 4.6,
    oneOffGainRatio: 3.6,
  },
  expectation: {
    source: 'public_forecast',
    netProfitLow: 47500000000,
    netProfitHigh: 49500000000,
    forecastNetProfit: 48600000000,
    targetPrice: 285,
    rating: '买入',
    asOfDate: '2025-10-20',
  },
};

describe('financialReports', () => {
  it('keeps annual, interim, quarterly reports and earnings previews from noisy announcements', () => {
    expect(normalizeFilingType('关于2025年半年度报告的公告')).toBe('interim');
    expect(normalizeFilingType('2025年前三季度业绩预告')).toBe('earnings_preview');
    expect(normalizeFilingType('2025年度业绩预披露公告')).toBe('earnings_preview');
    expect(normalizeFilingType('关于控股股东减持计划的公告')).toBe('other');

    expect(
      filterRelevantFilings([
        { ...baseReport.filing, id: 'a', title: '2025年年度报告', type: 'annual' },
        { ...baseReport.filing, id: 'b', title: '关于诉讼进展的公告', type: 'other' },
        { ...baseReport.filing, id: 'c', title: '2025年前三季度业绩预告', type: 'earnings_preview' },
      ]).map((filing) => filing.id),
    ).toEqual(['a', 'c']);
  });

  it('marks a report as above expectation when profit beats the public forecast with healthy cash flow', () => {
    const result = analyzeFinancialReport(baseReport);

    expect(result.verdict).toBe('above');
    expect(result.score).toBeGreaterThanOrEqual(80);
    expect(result.expectationGap?.basis).toBe('forecast_net_profit');
    expect(result.bullishDrivers).toEqual(
      expect.arrayContaining([
        expect.stringContaining('归母净利润高于公开盈利预测'),
        expect.stringContaining('经营现金流覆盖归母净利润'),
      ]),
    );
    expect(result.riskFlags.some((flag) => flag.severity === 'high')).toBe(false);
  });

  it('does not call a profit beat clean when deducted profit and cash flow quality are weak', () => {
    const result = analyzeFinancialReport({
      ...baseReport,
      financials: {
        ...baseReport.financials,
        netProfit: 52000000000,
        deductedNetProfit: 32000000000,
        deductedNetProfitYoY: -8,
        operatingCashFlow: 18000000000,
        accountsReceivableYoY: 72,
        inventoryYoY: 58,
        oneOffGainRatio: 38,
      },
    });

    expect(result.verdict).toBe('mixed');
    expect(result.riskFlags.map((flag) => flag.id)).toEqual(
      expect.arrayContaining(['weak-deducted-profit', 'cash-flow-mismatch', 'receivable-pressure', 'inventory-pressure', 'one-off-profit']),
    );
  });

  it('falls back to history and guidance when public forecast data is unavailable', () => {
    const result = analyzeFinancialReport({
      ...baseReport,
      expectation: { source: 'unavailable' },
      financials: {
        ...baseReport.financials,
        revenueYoY: -4.2,
        netProfitYoY: -16.4,
        deductedNetProfitYoY: -22.8,
        operatingCashFlowYoY: -35.5,
      },
    });

    expect(result.verdict).toBe('below');
    expect(result.expectationGap?.basis).toBe('historical_trend');
    expect(result.summary).toContain('公开一致预期缺失');
  });

  it('ranks analyzed filings by report date with the newest first', () => {
    const rows = rankFilingAnalyses([
      analyzeFinancialReport({ ...baseReport, filing: { ...baseReport.filing, id: 'old', reportDate: '2024-03-30' } }),
      analyzeFinancialReport({ ...baseReport, filing: { ...baseReport.filing, id: 'new', reportDate: '2025-03-30' } }),
    ]);

    expect(rows.map((row) => row.filing.id)).toEqual(['new', 'old']);
  });
});
