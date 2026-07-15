import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IndustryMarketMap } from './IndustryMarketMap';
import { buildIndustryMarketMap } from '../data/industryMarketMap';

describe('IndustryMarketMap', () => {
  it('renders grouped semantic buttons with complete market context', () => {
    const html = renderToStaticMarkup(<IndustryMarketMap boards={[{ code: 'BK1', name: '银行', level: 2, heat: 88, change: 1.25, capitalFlow: 6, valuation: '均衡', momentum: '走强', trend: 'up' }]} metric="heat" onActivate={() => undefined} />);
    expect(html).toContain('<button');
    expect(html).toContain('银行 BK1 涨跌幅 +1.25% 热度 88 资金流 +6.00 亿');
    expect(html).toContain('industry-market-map__group-label');
  });

  it('shows only the industry name when a cell is too small for two readable lines', () => {
    const html = renderToStaticMarkup(<IndustryMarketMap boards={[
      { code: 'SMALL', name: '小行业', level: 2, heat: 0, change: -0.2, capitalFlow: 0, valuation: '均衡', momentum: '平稳', trend: 'down' },
      { code: 'LARGE', name: '大行业', level: 2, heat: 100, change: 3, capitalFlow: 2, valuation: '强势', momentum: '走强', trend: 'up' },
    ]} metric="heat" onActivate={() => undefined} />);
    const smallButton = html.match(/<button[^>]*aria-label="小行业[^>]*>(.*?)<\/button>/)?.[1];
    expect(smallButton).toContain('<strong>小行业</strong>');
    expect(smallButton).not.toContain('<span>');
  });

  it('uses the stable viewport baseline instead of total board count', () => {
    const boards = Array.from({ length: 80 }, (_, index) => ({ code: `B${index}`, name: ['银行', '软件', '医药', '煤炭'][index % 4], level: 2 as const, heat: index, change: 1, capitalFlow: 0, valuation: '均衡', momentum: '平稳', trend: 'up' as const }));
    const expectedHeight = buildIndustryMarketMap(boards, 'heat', 920, 440).bounds.height;
    const html = renderToStaticMarkup(<IndustryMarketMap boards={boards} metric="heat" onActivate={() => undefined} />);
    expect(html).toContain(`height:${expectedHeight}px`);
    expect(expectedHeight).toBeLessThan(1000);
  });

  it('associates every market button with its group label element', () => {
    const html = renderToStaticMarkup(<IndustryMarketMap boards={[{ code: 'BK1', name: '银行', level: 2, heat: 88, change: 1.25, capitalFlow: 6, valuation: '均衡', momentum: '走强', trend: 'up' }]} metric="heat" onActivate={() => undefined} />);
    const labelId = html.match(/<span[^>]*id="([^"]+)"[^>]*class="industry-market-map__group-label"/)?.[1];
    const describedBy = html.match(/<button[^>]*aria-describedby="([^"]+)"/)?.[1];
    expect(labelId).toBeTruthy();
    expect(describedBy).toBe(labelId);
  });
});
