export type KlinePeriod = '15m' | '60m' | 'daily' | 'weekly';

export type PriceBar = {
  time: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  amplitude: number;
};

export type PriceLevelType = 'buy' | 'stop' | 'support' | 'resistance' | 'manual';

export type PriceLevelSource = 'manual' | 'auto' | 'system';

export type PriceLevel = {
  id: string;
  type: Exclude<PriceLevelType, 'buy' | 'stop'>;
  price: number;
  source: PriceLevelSource;
  strength?: number;
};

export type KlineData = {
  code: string;
  name: string;
  period: KlinePeriod;
  bars: PriceBar[];
};

type Fetcher = (input: string) => Promise<Pick<Response, 'ok' | 'json'>>;

type FetchKlineDataOptions = {
  code: string;
  period: KlinePeriod;
  fetcher?: Fetcher;
  limit?: number;
};

type EastmoneyKlineResponse = {
  rc?: number;
  data?: {
    code?: string;
    name?: string;
    klines?: string[];
  };
};

export const KLINE_PERIODS: Array<{ value: KlinePeriod; label: string; klt: string; limit: number }> = [
  { value: '15m', label: '15分钟', klt: '15', limit: 160 },
  { value: '60m', label: '60分钟', klt: '60', limit: 160 },
  { value: 'daily', label: '日K', klt: '101', limit: 180 },
  { value: 'weekly', label: '周K', klt: '102', limit: 120 },
];

export function getSecid(input: string): string {
  const code = input.trim();

  if (/^[659]/.test(code)) {
    return `1.${code}`;
  }

  return `0.${code}`;
}

export function parseManualLevels(input: string): number[] {
  const seen = new Set<number>();

  return input
    .split(/[\s,，;；]+/)
    .map((part) => Number(part.trim()))
    .filter((price) => Number.isFinite(price) && price > 0)
    .filter((price) => {
      const normalized = roundPrice(price);

      if (seen.has(normalized)) {
        return false;
      }

      seen.add(normalized);
      return true;
    })
    .map(roundPrice);
}

export async function fetchKlineData({
  code,
  period,
  fetcher = fetch,
  limit,
}: FetchKlineDataOptions): Promise<KlineData> {
  const periodConfig = KLINE_PERIODS.find((item) => item.value === period);

  if (!periodConfig) {
    throw new Error('不支持的K线周期');
  }

  const normalizedCode = code.trim();
  const url = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get');
  url.searchParams.set('secid', getSecid(normalizedCode));
  url.searchParams.set('klt', periodConfig.klt);
  url.searchParams.set('fqt', '1');
  url.searchParams.set('lmt', String(limit ?? periodConfig.limit));
  url.searchParams.set('end', '20500101');
  url.searchParams.set('iscca', '1');
  url.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6');
  url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58');

  const response = await fetcher(url.toString());

  if (!response.ok) {
    throw new Error('K线数据请求失败');
  }

  const payload = (await response.json()) as EastmoneyKlineResponse;
  const bars = (payload.data?.klines ?? []).map(parseKlineRow).filter((bar): bar is PriceBar => Boolean(bar));

  return {
    code: payload.data?.code ?? normalizedCode,
    name: payload.data?.name ?? normalizedCode,
    period,
    bars,
  };
}

export function deriveAutoLevels(bars: PriceBar[], maxLevels = 8): PriceLevel[] {
  const candidates: Array<{ type: 'support' | 'resistance'; price: number; index: number }> = [];

  for (let index = 1; index < bars.length - 1; index += 1) {
    const previous = bars[index - 1];
    const current = bars[index];
    const next = bars[index + 1];

    if (!previous || !current || !next) {
      continue;
    }

    if (current.low < previous.low && current.low < next.low) {
      candidates.push({ type: 'support', price: current.low, index });
    }

    if (current.high > previous.high && current.high > next.high) {
      candidates.push({ type: 'resistance', price: current.high, index });
    }
  }

  const close = bars.at(-1)?.close ?? 0;
  const tolerance = Math.max(close * 0.004, 0.02);
  const grouped = groupNearbyLevels(candidates, tolerance);

  return grouped
    .sort((a, b) => (b.strength ?? 0) - (a.strength ?? 0))
    .slice(0, maxLevels)
    .map((level, index) => ({ ...level, id: `auto-${level.type}-${index}-${level.price}` }))
    .sort((a, b) => a.price - b.price);
}

export function calculateStopLoss(buyPrice: number, supportPrices: number[]): number {
  const nearestSupport = supportPrices
    .filter((price) => price > 0 && price < buyPrice)
    .sort((a, b) => b - a)[0];

  return roundPrice(nearestSupport ?? buyPrice * 0.97);
}

export function calculateMovePercent(buyPrice: number, targetPrice: number): number {
  if (!Number.isFinite(buyPrice) || buyPrice <= 0) {
    return 0;
  }

  return roundPercent(((targetPrice - buyPrice) / buyPrice) * 100);
}

export function roundPrice(price: number): number {
  return Number(price.toFixed(2));
}

function roundPercent(value: number): number {
  return Number(value.toFixed(2));
}

function parseKlineRow(row: string): PriceBar | null {
  const [time, open, close, high, low, volume, amount, amplitude] = row.split(',');
  const parsed = {
    time,
    open: Number(open),
    close: Number(close),
    high: Number(high),
    low: Number(low),
    volume: Number(volume),
    amount: Number(amount),
    amplitude: Number(amplitude),
  };

  if (
    !parsed.time ||
    !Number.isFinite(parsed.open) ||
    !Number.isFinite(parsed.close) ||
    !Number.isFinite(parsed.high) ||
    !Number.isFinite(parsed.low)
  ) {
    return null;
  }

  return parsed;
}

function groupNearbyLevels(
  candidates: Array<{ type: 'support' | 'resistance'; price: number; index: number }>,
  tolerance: number,
): PriceLevel[] {
  const groups: Array<{ type: 'support' | 'resistance'; prices: number[]; indexes: number[] }> = [];

  candidates.forEach((candidate) => {
    const group = groups.find(
      (item) =>
        item.type === candidate.type &&
        Math.abs(average(item.prices) - candidate.price) <= tolerance,
    );

    if (group) {
      group.prices.push(candidate.price);
      group.indexes.push(candidate.index);
      return;
    }

    groups.push({ type: candidate.type, prices: [candidate.price], indexes: [candidate.index] });
  });

  return groups.map((group) => {
    const recency = Math.max(...group.indexes) / Math.max(...candidates.map((candidate) => candidate.index), 1);
    const price = roundPrice(average(group.prices));

    return {
      id: '',
      type: group.type,
      price,
      source: 'auto',
      strength: Number((group.prices.length + recency).toFixed(2)),
    };
  });
}

function average(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / Math.max(values.length, 1);
}
