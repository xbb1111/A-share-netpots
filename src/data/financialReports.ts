export type FilingType = 'annual' | 'interim' | 'quarterly' | 'earnings_preview' | 'other';

export type Security = {
  code: string;
  name: string;
  industry: string;
  exchange: 'SSE' | 'SZSE' | 'BSE' | 'UNKNOWN';
};

export type FilingSummary = {
  id: string;
  title: string;
  type: FilingType;
  reportDate: string;
  source: 'cninfo' | 'eastmoney' | 'manual';
  url: string;
};

export type FinancialSnapshot = {
  period: string;
  revenue?: number;
  revenueYoY?: number;
  netProfit?: number;
  netProfitYoY?: number;
  deductedNetProfit?: number;
  deductedNetProfitYoY?: number;
  grossMargin?: number;
  grossMarginYoYDelta?: number;
  operatingCashFlow?: number;
  operatingCashFlowYoY?: number;
  roe?: number;
  debtAssetRatio?: number;
  accountsReceivableYoY?: number;
  inventoryYoY?: number;
  sellingExpenseRatio?: number;
  managementExpenseRatio?: number;
  oneOffGainRatio?: number;
};

export type ExpectationSnapshot = {
  source: 'public_forecast' | 'company_guidance' | 'unavailable';
  netProfitLow?: number;
  netProfitHigh?: number;
  forecastNetProfit?: number;
  targetPrice?: number;
  rating?: string;
  asOfDate?: string;
};

export type FinancialReportInput = {
  security: Security;
  filing: FilingSummary;
  financials: FinancialSnapshot;
  expectation: ExpectationSnapshot;
};

export type ExpectationGap = {
  basis: 'forecast_net_profit' | 'guidance_range' | 'historical_trend' | 'reported_financials';
  percent: number | null;
  label: string;
};

export type RiskFlag = {
  id: string;
  label: string;
  severity: 'high' | 'medium' | 'low';
  value?: string;
  benchmark?: string;
  source?: string;
};

export type ComponentScore = {
  id: string;
  label: string;
  score: number | null;
  status: 'positive' | 'neutral' | 'negative' | 'missing';
  detail: string;
  data: Array<{ label: string; value: string; source: string }>;
};

export type FinancialMetricPeriod = 'quarterly' | 'annual';

export type FinancialMetricCatalogItem = {
  id: string;
  label: string;
  unit: string;
  category: string;
  chartType: 'line' | 'bar';
};

export type FinancialMetricPoint = {
  period: string;
  reportDate: string;
  value: number | null;
  yoy: number | null;
  qoq: number | null;
};

export type FinancialMetricBenchmarkPoint = {
  period: string;
  median: number | null;
  max: number | null;
  min: number | null;
};

export type FinancialMetricPeer = {
  security: Security;
  series: Record<string, FinancialMetricPoint[]>;
};

export type FinancialMetricsResult = {
  security: Security;
  metricCatalog: FinancialMetricCatalogItem[];
  periods: string[];
  series: Record<string, FinancialMetricPoint[]>;
  peers: FinancialMetricPeer[];
  industryBenchmark: Record<string, FinancialMetricBenchmarkPoint[]>;
};

export type ScoreBreakdown = {
  formula: string;
  componentAverage: number;
  missingPenalty: number;
  highRiskPenalty: number;
  finalScore: number;
  rows: Array<{
    id: string;
    label: string;
    score: number | null;
    weight: number;
    status: ComponentScore['status'];
    evidence: string;
    rule: string;
  }>;
  waterfall: Array<{ label: string; value: number }>;
};

export type FilingAnalysisResult = {
  security: Security;
  filing: FilingSummary;
  verdict: 'above' | 'in_line' | 'below' | 'mixed';
  score: number;
  expectationGap: ExpectationGap | null;
  bullishDrivers: string[];
  riskFlags: RiskFlag[];
  componentScores?: ComponentScore[];
  scoreBreakdown?: ScoreBreakdown;
  methodology?: {
    engine: string;
    rules: string[];
    expectationStandard: string;
    aiPrompt?: string;
  };
  industryChecklist: string[];
  summary: string;
};

const RELEVANT_TYPES: FilingType[] = ['annual', 'interim', 'quarterly', 'earnings_preview'];

export function normalizeFilingType(title: string): FilingType {
  if (/业绩预告|业绩快报|业绩预增|业绩预减|盈利预告|业绩预披露|预披露/.test(title)) {
    return 'earnings_preview';
  }

  if (/半年度报告|半年报|中期报告/.test(title)) {
    return 'interim';
  }

  if (/季度报告|一季报|三季报|第三季度|第一季度/.test(title)) {
    return 'quarterly';
  }

  if (/年度报告|年报/.test(title)) {
    return 'annual';
  }

  return 'other';
}

export function filterRelevantFilings(filings: FilingSummary[]): FilingSummary[] {
  return filings
    .map((filing) => ({ ...filing, type: filing.type === 'other' ? normalizeFilingType(filing.title) : filing.type }))
    .filter((filing) => RELEVANT_TYPES.includes(filing.type));
}

export function analyzeFinancialReport(input: FinancialReportInput): FilingAnalysisResult {
  const riskFlags = deriveRiskFlags(input.financials);
  const bullishDrivers = deriveBullishDrivers(input);
  const expectationGap = calculateExpectationGap(input.financials, input.expectation);
  const verdict = deriveVerdict(input.financials, input.expectation, expectationGap, riskFlags);
  const score = calculateScore(verdict, input.financials, riskFlags, bullishDrivers);
  const industryChecklist = buildIndustryChecklist(input.security.industry);
  const summary = buildSummary(input, verdict, expectationGap, riskFlags);

  return {
    security: input.security,
    filing: input.filing,
    verdict,
    score,
    expectationGap,
    bullishDrivers,
    riskFlags,
    industryChecklist,
    summary,
  };
}

export function rankFilingAnalyses(results: FilingAnalysisResult[]): FilingAnalysisResult[] {
  return [...results].sort((a, b) => b.filing.reportDate.localeCompare(a.filing.reportDate));
}

function calculateExpectationGap(
  financials: FinancialSnapshot,
  expectation: ExpectationSnapshot,
): ExpectationGap | null {
  if (!isFinitePositive(financials.netProfit)) {
    return null;
  }

  if (isFinitePositive(expectation.forecastNetProfit)) {
    const percent = roundPercent(((financials.netProfit - expectation.forecastNetProfit) / expectation.forecastNetProfit) * 100);
    return { basis: 'forecast_net_profit', percent, label: `归母净利润较公开盈利预测${formatSignedPercent(percent)}` };
  }

  if (isFinitePositive(expectation.netProfitLow) && isFinitePositive(expectation.netProfitHigh)) {
    const midpoint = (expectation.netProfitLow + expectation.netProfitHigh) / 2;
    const percent = roundPercent(((financials.netProfit - midpoint) / midpoint) * 100);
    return { basis: 'guidance_range', percent, label: `归母净利润较公司预告中值${formatSignedPercent(percent)}` };
  }

  const historicalSignal = averageDefined([financials.revenueYoY, financials.netProfitYoY, financials.deductedNetProfitYoY]);
  return {
    basis: 'historical_trend',
    percent: Number.isFinite(historicalSignal) ? roundPercent(historicalSignal) : null,
    label: '公开一致预期缺失，改用历史增速和利润质量判断',
  };
}

function deriveVerdict(
  financials: FinancialSnapshot,
  expectation: ExpectationSnapshot,
  gap: ExpectationGap | null,
  riskFlags: RiskFlag[],
): FilingAnalysisResult['verdict'] {
  const highRiskCount = riskFlags.filter((flag) => flag.severity === 'high').length;
  const qualityWarnings = riskFlags.filter((flag) =>
    ['weak-deducted-profit', 'cash-flow-mismatch', 'one-off-profit'].includes(flag.id),
  ).length;

  if (qualityWarnings >= 2 && (gap?.percent ?? 0) >= 3) {
    return 'mixed';
  }

  if (gap?.basis === 'forecast_net_profit' || gap?.basis === 'guidance_range') {
    if ((gap.percent ?? 0) >= 3 && highRiskCount === 0) {
      return 'above';
    }

    if ((gap.percent ?? 0) <= -3 || highRiskCount >= 2) {
      return 'below';
    }

    return highRiskCount > 0 ? 'mixed' : 'in_line';
  }

  if (expectation.source === 'unavailable') {
    const weakGrowth = [financials.revenueYoY, financials.netProfitYoY, financials.deductedNetProfitYoY].filter(
      (value) => Number.isFinite(value) && Number(value) < -5,
    ).length;

    if (weakGrowth >= 2 || highRiskCount >= 2) {
      return 'below';
    }

    if ((financials.netProfitYoY ?? 0) > 20 && highRiskCount === 0) {
      return 'above';
    }
  }

  return highRiskCount > 0 ? 'mixed' : 'in_line';
}

function deriveRiskFlags(financials: FinancialSnapshot): RiskFlag[] {
  const flags: RiskFlag[] = [];

  if (
    isFinitePositive(financials.netProfit) &&
    isFinitePositive(financials.deductedNetProfit) &&
    financials.deductedNetProfit / financials.netProfit < 0.75
  ) {
    flags.push({ id: 'weak-deducted-profit', label: '扣非净利润明显弱于归母净利润', severity: 'high' });
  }

  if (
    isFinitePositive(financials.netProfit) &&
    Number.isFinite(financials.operatingCashFlow) &&
    Number(financials.operatingCashFlow) / financials.netProfit < 0.7
  ) {
    flags.push({ id: 'cash-flow-mismatch', label: '经营现金流对利润覆盖不足', severity: 'high' });
  }

  if ((financials.accountsReceivableYoY ?? 0) >= 50) {
    flags.push({ id: 'receivable-pressure', label: '应收账款增速偏高', severity: 'medium' });
  }

  if ((financials.inventoryYoY ?? 0) >= 45) {
    flags.push({ id: 'inventory-pressure', label: '存货增速偏高，需核验跌价和渠道库存', severity: 'medium' });
  }

  if ((financials.oneOffGainRatio ?? 0) >= 25) {
    flags.push({ id: 'one-off-profit', label: '非经常性收益占比偏高', severity: 'high' });
  }

  if ((financials.debtAssetRatio ?? 0) >= 75) {
    flags.push({ id: 'leverage-pressure', label: '资产负债率偏高', severity: 'medium' });
  }

  if ((financials.grossMarginYoYDelta ?? 0) <= -2) {
    flags.push({ id: 'margin-pressure', label: '毛利率同比下滑', severity: 'medium' });
  }

  return flags;
}

function deriveBullishDrivers(input: FinancialReportInput): string[] {
  const drivers: string[] = [];
  const { financials, expectation } = input;

  if (
    isFinitePositive(financials.netProfit) &&
    isFinitePositive(expectation.forecastNetProfit) &&
    financials.netProfit > expectation.forecastNetProfit * 1.03
  ) {
    drivers.push('归母净利润高于公开盈利预测');
  }

  if ((financials.netProfitYoY ?? 0) >= 20) {
    drivers.push('归母净利润同比高增');
  }

  if ((financials.revenueYoY ?? 0) >= 15) {
    drivers.push('营业收入保持较快增长');
  }

  if (
    isFinitePositive(financials.netProfit) &&
    Number.isFinite(financials.operatingCashFlow) &&
    Number(financials.operatingCashFlow) / financials.netProfit >= 0.9
  ) {
    drivers.push('经营现金流覆盖归母净利润');
  }

  if ((financials.grossMarginYoYDelta ?? 0) > 1) {
    drivers.push('毛利率同比改善');
  }

  return drivers;
}

function calculateScore(
  verdict: FilingAnalysisResult['verdict'],
  financials: FinancialSnapshot,
  riskFlags: RiskFlag[],
  drivers: string[],
): number {
  const baseScore = verdict === 'above' ? 76 : verdict === 'in_line' ? 62 : verdict === 'mixed' ? 54 : 42;
  const growthBonus = Math.max(Math.min((financials.netProfitYoY ?? 0) / 4, 12), -12);
  const driverBonus = Math.min(drivers.length * 3, 12);
  const riskPenalty = riskFlags.reduce((total, flag) => total + (flag.severity === 'high' ? 12 : flag.severity === 'medium' ? 7 : 3), 0);

  return Math.round(clamp(baseScore + growthBonus + driverBonus - riskPenalty, 0, 100));
}

function buildIndustryChecklist(industry: string): string[] {
  if (/电力设备|汽车|机械|制造|电子|半导体/.test(industry)) {
    return ['毛利率是否改善', '存货和应收是否异常扩张', '经营现金流是否覆盖利润', '产能/价格周期是否支持后续增长'];
  }

  if (/消费|食品|医药|家电|零售/.test(industry)) {
    return ['收入增速是否来自真实动销', '销售费用率是否吞噬利润', '渠道库存是否上升', '毛利率是否稳定'];
  }

  if (/煤炭|有色|钢铁|化工|能源/.test(industry)) {
    return ['利润是否由价格周期驱动', '库存跌价风险是否上升', '资本开支和现金流是否匹配', '分红和负债压力是否可控'];
  }

  if (/银行|保险|证券|地产/.test(industry)) {
    return ['金融地产口径差异较大，第一版仅给低置信度提示', '需补充资产质量、拨备、久期或销售回款指标'];
  }

  return ['收入和利润增速是否匹配', '现金流是否支撑利润', '扣非利润是否可靠', '资产负债和营运资本是否异常'];
}

function buildSummary(
  input: FinancialReportInput,
  verdict: FilingAnalysisResult['verdict'],
  gap: ExpectationGap | null,
  riskFlags: RiskFlag[],
): string {
  const verdictText = {
    above: '整体超预期',
    in_line: '整体符合预期',
    below: '整体不及预期',
    mixed: '表观结果与质量信号分化',
  }[verdict];
  const gapText = gap ? gap.label : '关键盈利数据不足，无法计算预期差';
  const sourceText = input.expectation.source === 'unavailable' ? '公开一致预期缺失，' : '';
  const riskText = riskFlags.length > 0 ? `主要雷点：${riskFlags.map((flag) => flag.label).join('、')}。` : '暂未识别高优先级雷点。';

  return `${input.security.name}${input.financials.period} ${verdictText}：${sourceText}${gapText}。${riskText}`;
}

function averageDefined(values: Array<number | undefined>): number {
  const defined = values.filter((value): value is number => Number.isFinite(value));
  return defined.reduce((total, value) => total + value, 0) / Math.max(defined.length, 1);
}

function isFinitePositive(value: unknown): value is number {
  return Number.isFinite(value) && Number(value) > 0;
}

function roundPercent(value: number): number {
  return Number(value.toFixed(2));
}

function formatSignedPercent(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
