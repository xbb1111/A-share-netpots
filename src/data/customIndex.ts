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
  showBenchmark?: boolean;
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
  openingWeights: Record<string, number>;
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
    if (!Number.isFinite(totalMarketCap) || components.some((item) => !Number.isFinite(item.marketCap) || (item.marketCap ?? 0) <= 0)) {
      throw new Error('市值数据不足，无法计算市值权重');
    }
    return Object.fromEntries(
      components.map((component) => [component.code, (component.marketCap ?? 0) / totalMarketCap]),
    );
  }

  const totalWeight = components.reduce((sum, component) => sum + (component.targetWeight ?? 0), 0);
  if (components.some((item) => !Number.isFinite(item.targetWeight ?? 0) || (item.targetWeight ?? 0) < 0)) throw new Error('权重必须是非负有限数值');
  if (Math.abs(totalWeight - 100) > EPSILON) {
    throw new Error('权重合计必须为 100%');
  }

  return Object.fromEntries(components.map((component) => [component.code, (component.targetWeight ?? 0) / 100]));
}

export function getWeightInputDisplayValue(
  components: IndexComponent[],
  method: WeightMethod,
  code: string,
  cachedValue?: string,
): string {
  if (method === 'custom' && cachedValue !== undefined) return cachedValue;

  const component = components.find((item) => item.code === code);
  if (!component) return '0';
  if (method === 'marketCap' && components.some((item) => !Number.isFinite(item.marketCap) || (item.marketCap ?? 0) <= 0)) return '—';
  const percent = method === 'custom'
    ? component.targetWeight ?? 0
    : (calculateTargetWeights(components, method)[code] ?? 0) * 100;

  return String(Number(percent.toFixed(2)));
}

export function prepareComponentsForWeightMethod(
  components: IndexComponent[],
  currentMethod: WeightMethod,
  nextMethod: WeightMethod,
): IndexComponent[] {
  if (nextMethod === 'custom' && currentMethod === 'custom') return components;
  const sourceMethod = nextMethod === 'custom' ? currentMethod : nextMethod;
  const weights = calculateTargetWeights(components, sourceMethod);
  // Allocate whole basis points; break equal remainders in reverse component order.
  const exact = components.map((component) => weights[component.code] * 10000);
  const basisPoints = exact.map(Math.floor);
  const unassigned = 10000 - basisPoints.reduce((sum, value) => sum + value, 0);
  const priority = exact.map((value, index) => ({ index, fraction: value - basisPoints[index] }))
    .sort((a, b) => b.fraction - a.fraction || b.index - a.index);
  for (const { index } of priority.slice(0, unassigned)) basisPoints[index] += 1;
  const targetWeights = basisPoints.map((value) => value / 100);
  return components.map((component, index) => ({
    ...component,
    targetWeight: targetWeights[index],
  }));
}

export function selectCoreComponents(
  components: IndexComponent[],
  weights: Record<string, number>,
  limit = 5,
): IndexComponent[] {
  return [...components]
    .sort((left, right) => (weights[right.code] ?? 0) - (weights[left.code] ?? 0))
    .slice(0, Math.max(0, limit));
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
  const dates = new Set<string>();
  const byDate = new Map<string, Map<string, PriceBar>>();
  for (const { code } of components) {
    const bars = new Map<string, PriceBar>();
    for (const bar of histories[code] ?? []) {
      if (!bar.date || !Number.isFinite(bar.close) || bar.close <= 0 || bars.has(bar.date)) continue;
      bars.set(bar.date, bar);
      dates.add(bar.date);
    }
    byDate.set(code, bars);
  }
  const allDates = [...dates].sort();
  const rows: Array<{ date: string; prices: Record<string, number>; bars: Record<string, PriceBar> }> = [];
  const lastPrices: Record<string, number> = {};
  const lastBars: Record<string, PriceBar> = {};

  for (const date of allDates) {
    let complete = true;
    for (const component of components) {
      const bar = byDate.get(component.code)?.get(date);
      if (bar) {
        lastPrices[component.code] = bar.close;
        lastBars[component.code] = bar;
      } else if (component.code in lastPrices) {
        lastBars[component.code] = { date, close: lastPrices[component.code] };
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
  if (!Number.isFinite(baseValue) || baseValue <= 0) throw new Error('基准净值必须是正数');
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
      openingWeights: { ...weights },
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
      openingWeights: { ...weights },
      constituentReturns,
    });
    Object.assign(weights, driftedWeights);
    previousPeriod = period;
  }

  return series;
}

const periodsPerYear: Record<IndexBarPeriod, number> = {
  '15m': 252 * 16,
  '30m': 252 * 8,
  '60m': 252 * 4,
  daily: 252,
  weekly: 52,
};

export function calculateIndexMetrics(series: IndexPoint[], period: IndexBarPeriod = 'daily'): IndexMetrics {
  if (series.length < 2) {
    return { totalReturn: 0, annualizedReturn: 0, annualizedVolatility: 0, maxDrawdown: 0, maxDrawdownDuration: 0 };
  }

  const returns = series.slice(1).map((point) => point.dailyReturn);
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / returns.length;
  const start = series[0].value;
  const end = series.at(-1)?.value ?? start;
  const totalReturn = end / start - 1;
  const years = returns.length / periodsPerYear[period];
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
    annualizedVolatility: Math.sqrt(variance) * Math.sqrt(periodsPerYear[period]),
    maxDrawdown,
    maxDrawdownDuration,
  };
}

export function alignBenchmark(series: Pick<IndexPoint, 'date' | 'value'>[], history: PriceBar[]) {
  const closes = new Map(history.filter((bar) => Number.isFinite(bar.close) && bar.close > 0)
    .map((bar) => [bar.date, bar.close]));
  const values = new Map<string, number>();
  let scale: number | undefined;
  for (const point of series) {
    const close = closes.get(point.date);
    if (close === undefined) continue;
    scale ??= point.value / close;
    values.set(point.date, close * scale);
  }
  return values;
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
    contribution: (point.openingWeights[component.code] ?? 0) * (point.constituentReturns[component.code] ?? 0),
  }));
}
