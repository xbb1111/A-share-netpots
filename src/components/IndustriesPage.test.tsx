import { describe, expect, it } from 'vitest';
import type { IndustryBoard, IndustryCompany } from '../data/types';
import { INDUSTRY_CHAINS } from '../data/industryTaxonomy';
import { createIndustryPreviewRequest, filterIndustryItems, findChainRouteForBoard, getCanvasPreviewSourcePath, getIndustryCloudSpan, getIndustryPreviewAvailability, makeIndustryIndexNode, shouldSyncIndustryRoute, sortIndustryCompanies } from './IndustriesPage';

const boards: IndustryBoard[] = [
  { code: 'BK1033', name: '电池', level: 1, change: 2, heat: 88, capitalFlow: 12, valuation: '强势', momentum: '上涨 2.00%', trend: 'up' },
];

const companies: IndustryCompany[] = [
  { code: '300750', name: '宁德时代', industry: '电池', price: 218, change: 2.4, capitalFlow: 9.2, marketCap: 987_000_000_000 },
  { code: '000001', name: '示例公司', industry: '电池', price: null, change: null, capitalFlow: null, marketCap: null },
];

describe('IndustriesPage helpers', () => {
  it('does not let a stale industry effect overwrite a toolbox navigation', () => {
    expect(shouldSyncIndustryRoute('#toolbox?tool=index&preview=test')).toBe(false);
    expect(shouldSyncIndustryRoute('#industries?industryView=market')).toBe(true);
  });
  it('builds a previewable industry index from loaded constituents', () => {
    const node = makeIndustryIndexNode(boards[0], companies);
    expect(node.name).toBe('电池');
    expect(node.stocks).toContainEqual(expect.objectContaining({ code: '300750', change: 2.4 }));
  });

  it('does not dispatch an empty preview and reports its disabled state', () => {
    const requests: unknown[] = [];
    const empty = createIndustryPreviewRequest(makeIndustryIndexNode(boards[0], []), 'equal', ['行业', boards[0].name]);
    if (empty.request) requests.push(empty.request);
    expect(empty).toMatchObject({ disabled: true, request: null });
    expect(empty.message).toContain('暂无可计算公司');
    expect(requests).toHaveLength(0);
  });

  it('disables a non-empty company panel when every security code is invalid', () => {
    const availability = getIndustryPreviewAvailability([{ ...companies[0], code: 'invalid' }], false);
    expect(availability).toEqual({ disabled: true, label: '预览行业指数', message: '当前标签暂无可计算公司' });
  });

  it('includes descendant companies and source context in preview requests', () => {
    const node = makeIndustryIndexNode(boards[0], companies);
    node.children.push({ id: 'child', name: '下游', stocks: [{ code: '600000', name: '下游公司', change: 0, marketCap: 1, pe: 1 }], children: [] });
    const result = createIndustryPreviewRequest(node, 'marketCap', ['产业链', '下游']);
    expect(result.request).toMatchObject({ node, method: 'marketCap', sourcePath: ['产业链', '下游'], totalCompanyCount: 3 });
    expect(result.disabled).toBe(false);
  });

  it('builds a complete canvas source path without repeating the canvas root name', () => {
    const path = [{ id: 'root', name: '新能源', stocks: [], children: [] }, { id: 'child', name: '电池', stocks: [], children: [] }];
    expect(getCanvasPreviewSourcePath('我的产业链', path)).toEqual(['我的产业链', '新能源', '电池']);
    expect(getCanvasPreviewSourcePath('新能源', path)).toEqual(['新能源', '电池']);
  });

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
