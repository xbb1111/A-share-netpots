import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EtfActivityPanel } from './EtfActivityPanel';
import { ACTIVITY_ETFS, buildEtfActivity, normalizeEtfHistories } from '../data/etfActivity';

afterEach(() => vi.unstubAllGlobals());

describe('ETF snapshot rendering', () => {
  it('immediately renders saved turnover and complete comparisons while checking the service', () => {
    const dates = Array.from({ length: 31 }, (_, index) => `2026-08-${String(index + 1).padStart(2, '0')}`)
      .filter((date) => ![0, 6].includes(new Date(`${date}T00:00:00Z`).getUTCDay()));
    const histories = ACTIVITY_ETFS.map((etf) => ({ ...etf, bars: dates.map((time) => ({ time, amount: 1e8 })), updatedAt: '2026-08-31T08:00:00Z' }));
    vi.stubGlobal('localStorage', { getItem: () => JSON.stringify(histories) });
    const html = renderToStaticMarkup(<EtfActivityPanel />);
    expect(html).toContain('成交额覆盖 10/10');
    expect(html).toContain('10.0 亿');
    expect(html).toContain('4.0 亿');
    expect(html).toContain('1.00x');
    expect(html).toContain('上次有效快照');
    expect(html).toContain('2026/8/31');
    const data = buildEtfActivity(normalizeEtfHistories(histories));
    expect(data.rows.every((row) => row.averageRatio !== null && row.fridayRatio !== null)).toBe(true);
  });
});
