import { describe, expect, it } from 'vitest';
import {
  calculateMovePercent,
  calculateBollingerBands,
  calculateMovingAverageSeries,
  calculatePriceDomain,
  calculatePointerPrice,
  calculateStopLoss,
  calculateVisibleBars,
  calculateZoomWindow,
  dedupeNearbyPriceLevels,
  deriveAutoLevels,
  fetchKlineData,
  getPointerLabelSide,
  getSecid,
  parseSecurityInput,
  resolveSecurityQuery,
  searchSecuritySuggestions,
  parseManualLevels,
  KLINE_PERIODS,
  toggleSelectedLevelIds,
  toggleSelectedStopLevelIds,
} from './priceDiscipline';

describe('priceDiscipline', () => {
  it('derives Eastmoney secids for common A-share and ETF codes', () => {
    expect(getSecid('300750')).toBe('0.300750');
    expect(getSecid('600519')).toBe('1.600519');
    expect(getSecid('510300')).toBe('1.510300');
    expect(getSecid('159919')).toBe('0.159919');
  });

  it('extracts codes and optional names from mixed security input', () => {
    expect(parseSecurityInput('亚翔集成 603929')).toEqual({ code: '603929', name: '亚翔集成' });
    expect(parseSecurityInput('603929 亚翔集成')).toEqual({ code: '603929', name: '亚翔集成' });
    expect(parseSecurityInput('603929')).toEqual({ code: '603929', name: '' });
    expect(parseSecurityInput('亚翔集成')).toEqual({ code: '', name: '亚翔集成' });
  });

  it('parses K-line API responses into typed price bars', async () => {
    const requestedUrls: string[] = [];
    const fetcher = async (url: string) => {
      requestedUrls.push(url);
      return {
        ok: true,
        json: async () => ({
          rc: 0,
          data: {
            code: '300750',
            name: '宁德时代',
            klines: ['2026-07-07,376.00,375.20,378.88,372.89,102025,3831180925.94,1.60'],
          },
        }),
      };
    };

    const result = await fetchKlineData({ code: '300750', period: 'daily', fetcher });

    expect(requestedUrls[0]).toContain('secid=0.300750');
    expect(requestedUrls[0]).toContain('klt=101');
    expect(result).toMatchObject({
      code: '300750',
      name: '宁德时代',
      period: 'daily',
      bars: [
        {
          time: '2026-07-07',
          open: 376,
          close: 375.2,
          high: 378.88,
          low: 372.89,
          volume: 102025,
          amount: 3831180925.94,
          amplitude: 1.6,
        },
      ],
    });
  });

  it('includes 30-minute K-line support for Eastmoney requests', async () => {
    const requestedUrls: string[] = [];
    const fetcher = async (url: string) => {
      requestedUrls.push(url);
      return {
        ok: true,
        json: async () => ({
          data: {
            code: '300750',
            name: 'stock',
            klines: ['2026-07-07 10:00,10,11,12,9,100,1000,3'],
          },
        }),
      };
    };

    await fetchKlineData({ code: '300750', period: '30m', fetcher });

    expect(KLINE_PERIODS.find((period) => period.value === '30m')).toMatchObject({
      label: expect.stringContaining('30'),
      klt: '30',
    });
    expect(requestedUrls[0]).toContain('klt=30');
  });

  it('resolves name-only security input through the search API', async () => {
    const fetcher = async () => ({
      ok: true,
      json: async () => ({
        QuotationCodeTable: {
          Data: [{ Code: '603929', Name: '亚翔集成', QuoteID: '1.603929' }],
        },
      }),
    });

    await expect(resolveSecurityQuery('亚翔集成', fetcher)).resolves.toEqual({
      code: '603929',
      name: '亚翔集成',
    });
  });

  it('returns multiple security suggestions for partial input', async () => {
    const fetcher = async () => ({
      ok: true,
      json: async () => ({
        QuotationCodeTable: {
          Data: [
            { Code: '603929', Name: '亚翔集成', QuoteID: '1.603929' },
            { Code: '000001', Name: '平安银行', QuoteID: '0.000001' },
            { Code: 'BAD', Name: '无效项' },
          ],
        },
      }),
    });

    await expect(searchSecuritySuggestions('亚', fetcher)).resolves.toEqual([
      { code: '603929', name: '亚翔集成' },
      { code: '000001', name: '平安银行' },
    ]);
  });

  it('does not search for blank security suggestions', async () => {
    const fetcher = async () => {
      throw new Error('search should not run for blank input');
    };

    await expect(searchSecuritySuggestions(' ', fetcher)).resolves.toEqual([]);
  });

  it('uses the parsed code immediately when security input already contains a code', async () => {
    const fetcher = async () => {
      throw new Error('search should not run when code is present');
    };

    await expect(resolveSecurityQuery('亚翔集成 603929', fetcher)).resolves.toEqual({
      code: '603929',
      name: '亚翔集成',
    });
  });

  it('parses manual price levels from commas, whitespace, and line breaks', () => {
    expect(parseManualLevels('370, 375.5\ninvalid 380 0 -2')).toEqual([370, 375.5, 380]);
  });

  it('detects automatic support and resistance levels from local lows and highs', () => {
    const levels = deriveAutoLevels([
      { time: '1', open: 100, close: 101, high: 105, low: 99, volume: 1, amount: 1, amplitude: 1 },
      { time: '2', open: 101, close: 102, high: 110, low: 100, volume: 1, amount: 1, amplitude: 1 },
      { time: '3', open: 102, close: 101, high: 106, low: 96, volume: 1, amount: 1, amplitude: 1 },
      { time: '4', open: 101, close: 103, high: 108, low: 101, volume: 1, amount: 1, amplitude: 1 },
      { time: '5', open: 103, close: 102, high: 111, low: 100, volume: 1, amount: 1, amplitude: 1 },
    ]);

    expect(levels).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'support', price: 96, source: 'auto' }),
        expect.objectContaining({ type: 'resistance', price: 110, source: 'auto' }),
      ]),
    );
  });

  it('merges nearby automatic levels into one displayed price level', () => {
    const levels = deriveAutoLevels([
      { time: '1', open: 100, close: 100, high: 106, low: 98, volume: 1, amount: 1, amplitude: 1 },
      { time: '2', open: 100, close: 101, high: 110, low: 99, volume: 1, amount: 1, amplitude: 1 },
      { time: '3', open: 101, close: 100, high: 107, low: 96, volume: 1, amount: 1, amplitude: 1 },
      { time: '4', open: 100, close: 101, high: 110.4, low: 99, volume: 1, amount: 1, amplitude: 1 },
      { time: '5', open: 101, close: 102, high: 106, low: 97, volume: 1, amount: 1, amplitude: 1 },
    ]);

    expect(levels.filter((level) => level.type === 'resistance')).toHaveLength(1);
    expect(levels.find((level) => level.type === 'resistance')).toMatchObject({
      price: 110.2,
      strength: expect.any(Number),
    });
  });

  it('uses the nearest support below buy price as stop loss and falls back to 3 percent', () => {
    expect(calculateStopLoss(100, [88, 96, 103])).toBe(96);
    expect(calculateStopLoss(100, [101, 103])).toBe(97);
  });

  it('calculates target moves relative to the buy price with two decimals', () => {
    expect(calculateMovePercent(100, 110.126)).toBe(10.13);
    expect(calculateMovePercent(100, 96)).toBe(-4);
  });

  it('selects the latest visible bars by window size', () => {
    const bars = Array.from({ length: 5 }, (_, index) => ({
      time: String(index + 1),
      open: index,
      close: index,
      high: index,
      low: index,
      volume: 1,
      amount: 1,
      amplitude: 1,
    }));

    expect(calculateVisibleBars(bars, 3).map((bar) => bar.time)).toEqual(['3', '4', '5']);
    expect(calculateVisibleBars(bars, 'all').map((bar) => bar.time)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('moves chart windows through continuous wheel zoom ranges', () => {
    expect(calculateZoomWindow(120, 160, 'in')).toBe(98);
    expect(calculateZoomWindow(98, 160, 'in')).toBe(80);
    expect(calculateZoomWindow(12, 160, 'in')).toBe(12);
    expect(calculateZoomWindow(98, 160, 'out')).toBe(120);
    expect(calculateZoomWindow(140, 160, 'out')).toBe('all');
    expect(calculateZoomWindow('all', 160, 'in')).toBe(131);
  });

  it('calculates a price-domain from visible highs lows and reference levels', () => {
    const domain = calculatePriceDomain(
      [
        { time: '1', open: 100, close: 102, high: 105, low: 98, volume: 1, amount: 1, amplitude: 1 },
        { time: '2', open: 102, close: 101, high: 108, low: 99, volume: 1, amount: 1, amplitude: 1 },
      ],
      [95, 112],
    );

    expect(domain[0]).toBeLessThan(95);
    expect(domain[1]).toBeGreaterThan(112);
    expect(domain[0]).toBeGreaterThan(80);
  });

  it('maps chart pointer y positions into price labels', () => {
    expect(calculatePointerPrice(18, 430, 18, 4, [100, 200])).toBe(200);
    expect(calculatePointerPrice(426, 430, 18, 4, [100, 200])).toBe(100);
    expect(calculatePointerPrice(222, 430, 18, 4, [100, 200])).toBe(150);
    expect(calculatePointerPrice(500, 430, 18, 4, [100, 200])).toBe(100);
  });

  it('chooses pointer price label side from relative x position', () => {
    expect(getPointerLabelSide(120, 600)).toBe('right');
    expect(getPointerLabelSide(520, 600)).toBe('left');
  });

  it('calculates moving average series from closing prices', () => {
    const bars = [1, 2, 3, 4, 5].map((close, index) => ({
      time: String(index + 1),
      open: close,
      close,
      high: close,
      low: close,
      volume: 1,
      amount: 1,
      amplitude: 1,
    }));

    expect(calculateMovingAverageSeries(bars, 3)).toEqual([null, null, 2, 3, 4]);
  });

  it('calculates 20-period Bollinger bands from closing prices', () => {
    const bars = Array.from({ length: 21 }, (_, index) => {
      const close = index + 1;
      return {
        time: String(close),
        open: close,
        close,
        high: close,
        low: close,
        volume: 1,
        amount: 1,
        amplitude: 1,
      };
    });

    const bands = calculateBollingerBands(bars, 20, 2);

    expect(bands[18]).toEqual({ mid: null, upper: null, lower: null });
    expect(bands[19].mid).toBe(10.5);
    expect(bands[20].mid).toBe(11.5);
    expect(bands[20].upper).toBeGreaterThan(bands[20].mid ?? 0);
    expect(bands[20].lower).toBeLessThan(bands[20].mid ?? 0);
  });

  it('keeps a pinned nearby price level visible while deduping chart rows', () => {
    const rows = [
      { id: 'support-1', type: 'support' as const, price: 67.02 },
      { id: 'buy', type: 'buy' as const, price: 67.9 },
      { id: 'support-2', type: 'support' as const, price: 68.53 },
      { id: 'resistance-1', type: 'resistance' as const, price: 68.55 },
    ];

    expect(dedupeNearbyPriceLevels(rows).map((row) => row.id)).not.toContain('resistance-1');
    expect(dedupeNearbyPriceLevels(rows, 'resistance-1').map((row) => row.id)).toContain('resistance-1');
  });

  it('toggles selected stop level ids without duplicates', () => {
    expect(toggleSelectedStopLevelIds([], 'support-1', true)).toEqual(['support-1']);
    expect(toggleSelectedStopLevelIds(['support-1'], 'support-1', true)).toEqual(['support-1']);
    expect(toggleSelectedStopLevelIds(['support-1', 'resistance-1'], 'support-1', false)).toEqual(['resistance-1']);
  });

  it('toggles generic selected level ids for pinning and stop selections', () => {
    expect(toggleSelectedLevelIds([], 'support-1', true)).toEqual(['support-1']);
    expect(toggleSelectedLevelIds(['support-1'], 'support-1', true)).toEqual(['support-1']);
    expect(toggleSelectedLevelIds(['support-1', 'resistance-1'], 'support-1', false)).toEqual(['resistance-1']);
  });
});
