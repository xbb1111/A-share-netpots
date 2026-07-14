import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { IndustryMarketMap } from './IndustryMarketMap';

describe('IndustryMarketMap', () => {
  it('renders grouped semantic buttons with complete market context', () => {
    const html = renderToStaticMarkup(<IndustryMarketMap boards={[{ code: 'BK1', name: '银行', level: 2, heat: 88, change: 1.25, capitalFlow: 6, valuation: '均衡', momentum: '走强', trend: 'up' }]} metric="heat" onActivate={() => undefined} />);
    expect(html).toContain('<button');
    expect(html).toContain('银行 BK1 涨跌幅 +1.25% 热度 88 资金流 +6.00 亿');
    expect(html).toContain('industry-market-map__group-label');
  });
});
