import { describe, expect, it } from 'vitest';
import { SECOND_TO_FIRST_LEVEL, chinaDateFromUnix, getIndustryMappingProfile, selectTopicalThemes, toLevelOneIndustry } from './sentiment-taxonomy.mjs';

describe('sentiment industry taxonomy', () => {
  it('maps all 128 SW level-two industries into 31 mutually exclusive level-one industries', () => {
    expect(SECOND_TO_FIRST_LEVEL.size).toBe(128);
    expect(new Set(SECOND_TO_FIRST_LEVEL.values()).size).toBe(31);
    expect(toLevelOneIndustry('半导体')).toBe('电子');
    expect(toLevelOneIndustry('通信设备')).toBe('通信');
    expect(toLevelOneIndustry('贵金属')).toBe('有色金属');
    expect(toLevelOneIndustry('航天装备Ⅱ')).toBe('国防军工');
    expect(toLevelOneIndustry('化学制药')).toBe('医药生物');
  });

  it('reports missing and newly unmapped source labels instead of silently accepting them', () => {
    expect(getIndustryMappingProfile(['半导体', '通信设备', '-', '未知新行业'])).toEqual({
      total: 4,
      mapped: 2,
      missing: 1,
      coverage: 0.5,
      unmapped: ['未知新行业'],
    });
  });

  it('excludes structural tags and ranks topical themes by turnover amount', () => {
    const selected = selectTopicalThemes([
      { name: '融资融券', amount: 9_000_000_000 },
      { name: '商业航天', amount: 8_000_000_000 },
      { name: '创新药', amount: 7_000_000_000 },
      { name: '半导体概念', amount: 6_000_000_000 },
      { name: '中证500', amount: 10_000_000_000 },
    ]);
    expect(selected).toEqual([
      { name: '商业航天', amountYi: 80 },
      { name: '创新药', amountYi: 70 },
      { name: '半导体概念', amountYi: 60 },
    ]);
  });

  it('formats source timestamps in the China trading date', () => {
    expect(chinaDateFromUnix(Date.parse('2026-08-24T08:00:00Z') / 1000)).toBe('2026-08-24');
  });
});
