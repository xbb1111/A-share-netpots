import { describe, expect, it } from 'vitest';
import type { IndustryBoard, IndustryCompany } from '../data/types';
import { INDUSTRY_CHAINS } from '../data/industryTaxonomy';
import { filterIndustryItems, findChainRouteForBoard, getIndustryCloudSpan, sortIndustryCompanies } from './IndustriesPage';

const boards: IndustryBoard[] = [
  { code: 'BK1033', name: '电池', level: 1, change: 2, heat: 88, capitalFlow: 12, valuation: '强势', momentum: '上涨 2.00%', trend: 'up' },
];

const companies: IndustryCompany[] = [
  { code: '300750', name: '宁德时代', industry: '电池', price: 218, change: 2.4, capitalFlow: 9.2, marketCap: 987_000_000_000 },
  { code: '000001', name: '示例公司', industry: '电池', price: null, change: null, capitalFlow: null, marketCap: null },
];

describe('IndustriesPage helpers', () => {
  it('finds industries, chain nodes, and companies with one query', () => {
    const result = filterIndustryItems('电池', boards, INDUSTRY_CHAINS, companies);
    expect(result.some((item) => item.kind === 'industry' && item.label === '电池')).toBe(true);
    expect(result.some((item) => item.kind === 'chain-node' && item.label === '动力电池')).toBe(true);
    expect(result.filter((item) => item.kind === 'company')).toHaveLength(2);
  });

  it('sorts missing numeric values after available values', () => {
    expect(sortIndustryCompanies(companies, 'change', 'desc').at(-1)?.change).toBeNull();
    expect(sortIndustryCompanies(companies, 'marketCap', 'asc').at(-1)?.marketCap).toBeNull();
  });

  it('sizes cloud tiles by the selected metric and routes matching industries to a chain node', () => {
    expect(getIndustryCloudSpan({ ...boards[0], heat: 95 }, 'heat', boards)).toBeGreaterThan(getIndustryCloudSpan(boards[0], 'heat', boards));
    expect(findChainRouteForBoard({ ...boards[0], name: '电池' }, INDUSTRY_CHAINS)).toMatchObject({ chainId: 'new-energy-vehicle', nodeId: 'power-battery' });
  });
});
