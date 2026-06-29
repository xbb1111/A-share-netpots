import { describe, expect, it } from 'vitest';
import { getDashboardData } from './marketService';

describe('getDashboardData', () => {
  it('returns a complete A-share research dashboard snapshot', () => {
    const data = getDashboardData();

    expect(data.overview).toHaveLength(4);
    expect(data.industries.length).toBeGreaterThanOrEqual(6);
    expect(data.watchlist.length).toBeGreaterThanOrEqual(6);
    expect(data.alerts.length).toBeGreaterThanOrEqual(4);
    expect(data.marketCalendar.length).toBeGreaterThanOrEqual(3);
    expect(data.watchlist.every((stock) => stock.score >= 0 && stock.score <= 100)).toBe(true);
    expect(data.industries.every((industry) => industry.heat >= 0 && industry.heat <= 100)).toBe(true);
  });
});
