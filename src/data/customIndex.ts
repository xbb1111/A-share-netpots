export type WeightMethod = 'equal' | 'marketCap' | 'custom';
export type RebalanceFrequency = 'none' | 'monthly' | 'quarterly' | 'semiannual' | 'annual';
export type IndexBarPeriod = '15m' | '30m' | '60m' | 'daily' | 'weekly';

export type IndexComponent = {
  code: string;
  name: string;
  industry: string;
  targetWeight?: number;
  marketCap?: number;
};

export type PriceBar = { date: string; open?: number; high?: number; low?: number; close: number };
export type PriceHistory = Record<string, PriceBar[]>;

export type CustomIndexConfig = {
  components: IndexComponent[];
  weightMethod: WeightMethod;
  rebalanceFrequency: RebalanceFrequency;
  period?: IndexBarPeriod;
  baseDate?: string;
  benchmarkCode?: string;
  baseValue?: number;
};

export type IndexPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  value: number;
  dailyReturn: number;
  weights: Record<string, number>;
  constituentReturns: Record<string, number>;
};

export type IndexMetrics = {
  totalReturn: number;
  annualizedReturn: number;
  annualizedVolatility: number;
  maxDrawdown: number;
  maxDrawdownDuration: number;
};

const EPSILON = 1e-8;

export function validateIndexComponents(components: IndexComponent[]) {
  if (components.length === 0) {
    throw new Error('至少需要 1 只成分股');
  }

  const codes = new Set<string>();
  for (const component of components) {
    if (codes.has(component.code)) {
      throw new Error('成分股不能重复');
    }
    codes.add(component.code);
  }
}

export function calculateTargetWeights(
  components: IndexComponent[],
  method: WeightMethod,
): Record<string, number> {
  validateIndexComponents(components);

  if (method === 'equal') {
    const weight = 1 / components.length;
    return Object.fromEntries(components.map((component) => [component.code, weight]));
  }

  if (method === 'marketCap') {
    const totalMarketCap = components.reduce((sum, component) => sum + (component.marketCap ?? 0), 0);
    if (totalMarketCap <= 0) {
      throw new Error('市值数据不足，无法计算市值权重');
    }
    return Object.fromEntries(
      components.map((component) => [component.code, (component.marketCap ?? 0) / totalMarketCap]),
    );
  }

  const totalWeight = components.reduce((sum, component) => sum + (component.targetWeight ?? 0), 0);
  if (Math.abs(totalWeight - 100) > EPSILON) {
    throw new Error('权重合计必须为 100%');
  }

  return Object.fromEntries(components.map((component) => [component.code, (component.targetWeight ?? 0) / 100]));
}

function normalizeHistory(history: PriceBar[]) {
  return [...history]
    .filter((bar) => Number.isFinite(bar.close) && bar.close > 0 && Boolean(bar.date))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function periodKey(date: string, frequency: RebalanceFrequency) {
  const [yearText, monthText] = date.split('-');
  const year = Number(yearText);
  const month = Number(monthText);

  if (frequency === 'monthly') return `${year}-${month}`;
  if (frequency === 'quarterly') return `${year}-${Math.ceil(month / 3)}`;
  if (frequency === 'semiannual') return `${year}-${Math.ceil(month / 6)}`;
  if (frequency === 'annual') return String(year);
  return 'constant';
}

function alignedPrices(components: IndexComponent[], histories: PriceHistory) {
  const normalized = new Map(components.map((component) => [component.code, normalizeHistory(histories[component.code] ?? [])]));
  const allDates = [...new Set([...normalized.values()].flat().map((bar) => bar.date))].sort();
  const rows: Array<{ date: string; prices: Record<string, number>; bars: Record<string, PriceBar> }> = [];
  const lastPrices: Record<string, number> = {};
  const lastBars: Record<string, PriceBar> = {};

  for (const date of allDates) {
    let complete = true;
    for (const component of components) {
      const bar = normalized.get(component.code)?.find((item) => item.date === date);
      if (bar) {
        lastPrices[component.code] = bar.close;
        lastBars[component.code] = bar;
      }
      if (!(component.code in lastPrices)) complete = false;
    }
    if (complete) rows.push({ date, prices: { ...lastPrices }, bars: { ...lastBars } });
  }

  if (rows.length < 2) {
    throw new Error('缺少成分股历史行情');
  }
  return rows;
}

export function calculateIndexSeries(config: CustomIndexConfig, histories: PriceHistory): IndexPoint[] {
  validateIndexComponents(config.components);
  const targetWeights = calculateTargetWeights(config.components, config.weightMethod);
  const alignedRows = alignedPrices(config.components, histories);
  const rows = config.baseDate
    ? alignedRows.filter((row) => row.date >= config.baseDate!)
    : alignedRows;
  if (rows.length < 2) {
    throw new Error('基准日之后缺少足够历史行情');
  }
  const weights = { ...targetWeights };
  const baseValue = config.baseValue ?? 100;
  const series: IndexPoint[] = [
    {
      date: rows[0].date,
      open: baseValue,
      high: baseValue,
      low: baseValue,
      close: baseValue,
      value: baseValue,
      dailyReturn: 0,
      weights: { ...weights },
      constituentReturns: Object.fromEntries(config.components.map((component) => [component.code, 0])),
    },
  ];
  let value = baseValue;
  let previousPeriod = periodKey(rows[0].date, config.rebalanceFrequency);

  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const previous = rows[rowIndex - 1];
    const row = rows[rowIndex];
    const constituentReturns: Record<string, number> = {};
    let dailyReturn = 0;

    for (const component of config.components) {
      const returnValue = row.prices[component.code] / previous.prices[component.code] - 1;
      constituentReturns[component.code] = returnValue;
      dailyReturn += weights[component.code] * returnValue;
    }

    const previousIndexValue = series[series.length - 1].value;
    value *= 1 + dailyReturn;
    const weightedRange = (field: 'open' | 'high' | 'low') => Object.entries(weights).reduce((sum, [code, weight]) => {
      const currentBar = row.bars[code];
      const previousBar = previous.bars[code];
      const currentPrice = currentBar[field] ?? currentBar.close;
      return sum + weight * (currentPrice / previousBar.close - 1);
    }, 0);
    const period = periodKey(row.date, config.rebalanceFrequency);
    const shouldRebalance = config.rebalanceFrequency !== 'none' && period !== previousPeriod;
    const driftedWeights: Record<string, number> = {};
    const gross = Object.entries(weights).reduce(
      (sum, [code, weight]) => sum + weight * (1 + constituentReturns[code]),
      0,
    );
    for (const component of config.components) {
      driftedWeights[component.code] = shouldRebalance
        ? targetWeights[component.code]
        : (weights[component.code] * (1 + constituentReturns[component.code])) / gross;
    }

    series.push({
      date: row.date,
      open: previousIndexValue * (1 + weightedRange('open')),
      high: previousIndexValue * (1 + weightedRange('high')),
      low: previousIndexValue * (1 + weightedRange('low')),
      close: value,
      value,
      dailyReturn,
      weights: { ...driftedWeights },
      constituentReturns,
    });
    Object.assign(weights, driftedWeights);
    previousPeriod = period;
  }

  return series;
}

export function calculateIndexMetrics(series: IndexPoint[]): IndexMetrics {
  if (series.length < 2) {
    return { totalReturn: 0, annualizedReturn: 0, annualizedVolatility: 0, maxDrawdown: 0, maxDrawdownDuration: 0 };
  }

  const returns = series.slice(1).map((point) => point.dailyReturn);
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  const start = series[0].value;
  const end = series.at(-1)?.value ?? start;
  const totalReturn = end / start - 1;
  const years = Math.max(returns.length / 252, 1 / 252);
  let peak = start;
  let maxDrawdown = 0;
  let currentDuration = 0;
  let maxDrawdownDuration = 0;

  for (const point of series) {
    peak = Math.max(peak, point.value);
    const drawdown = peak === 0 ? 0 : 1 - point.value / peak;
    maxDrawdown = Math.max(maxDrawdown, drawdown);
    currentDuration = drawdown > EPSILON ? currentDuration + 1 : 0;
    maxDrawdownDuration = Math.max(maxDrawdownDuration, currentDuration);
  }

  return {
    totalReturn,
    annualizedReturn: Math.pow(1 + totalReturn, 1 / years) - 1,
    annualizedVolatility: Math.sqrt(variance) * Math.sqrt(252),
    maxDrawdown,
    maxDrawdownDuration,
  };
}

export function calculateIndustryExposure(components: IndexComponent[], weights: Record<string, number>) {
  return components.reduce<Record<string, number>>((exposure, component) => {
    exposure[component.industry] = (exposure[component.industry] ?? 0) + (weights[component.code] ?? 0);
    return exposure;
  }, {});
}

export function calculateContribution(
  components: IndexComponent[],
  point: IndexPoint,
) {
  return components.map((component) => ({
    code: component.code,
    name: component.name,
    contribution: (point.weights[component.code] ?? 0) * (point.constituentReturns[component.code] ?? 0),
  }));
}
