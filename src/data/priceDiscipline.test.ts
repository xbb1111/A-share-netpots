import { describe, expect, it } from 'vitest';
import {
  calculateMovePercent,
  calculateStopLoss,
  deriveAutoLevels,
  fetchKlineData,
  getSecid,
  parseManualLevels,
} from './priceDiscipline';

describe('priceDiscipline', () => {
  it('derives Eastmoney secids for common A-share and ETF codes', () => {
    expect(getSecid('300750')).toBe('0.300750');
    expect(getSecid('600519')).toBe('1.600519');
    expect(getSecid('510300')).toBe('1.510300');
    expect(getSecid('159919')).toBe('0.159919');
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

  it('uses the nearest support below buy price as stop loss and falls back to 3 percent', () => {
    expect(calculateStopLoss(100, [88, 96, 103])).toBe(96);
    expect(calculateStopLoss(100, [101, 103])).toBe(97);
  });

  it('calculates target moves relative to the buy price with two decimals', () => {
    expect(calculateMovePercent(100, 110.126)).toBe(10.13);
    expect(calculateMovePercent(100, 96)).toBe(-4);
  });
});
