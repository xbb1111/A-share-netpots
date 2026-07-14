import { useMemo } from 'react';
import type { IndustryBoard } from '../data/types';
import { buildIndustryMarketMap, type IndustryMarketMetric } from '../data/industryMarketMap';

export function IndustryMarketMap({ boards, metric, onActivate }: { boards: IndustryBoard[]; metric: IndustryMarketMetric; onActivate: (board: IndustryBoard) => void }) {
  const height = Math.max(420, Math.ceil(boards.length / 18) * 250);
  const layout = useMemo(() => buildIndustryMarketMap(boards, metric, 920, height), [boards, metric, height]);
  return <div className="industry-market-map" aria-label="分组行业行情星群">
    <div className="industry-market-map__canvas" style={{ width: layout.bounds.width, height: layout.bounds.height }}>
      {layout.groups.map((group) => <section className="industry-market-map__group" aria-label={`${group.name}行业组`} key={group.id} style={{ left: group.x, top: group.y, width: group.width, height: group.height }}><span className="industry-market-map__group-label">{group.name}</span></section>)}
      {layout.items.map((item) => {
        const board = boards.find((candidate) => candidate.code === item.code)!;
        const change = `${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%`;
        const flow = Number.isFinite(item.capitalFlow) ? ` 资金流 ${item.capitalFlow! >= 0 ? '+' : ''}${item.capitalFlow!.toFixed(2)} 亿` : '';
        const description = `${item.name} ${item.code} 涨跌幅 ${change} 热度 ${item.heat}${flow}`;
        const diameter = item.r * 2;
        const compact = item.r < 24;
        return <button type="button" key={item.code} title={description} aria-label={description} onClick={() => onActivate(board)} className={`industry-market-map__item industry-market-map__item--${item.tone}${item.featured ? ' industry-market-map__item--featured' : ''}${compact ? ' industry-market-map__item--compact' : ''}`} style={{ left: item.x - item.r, top: item.y - item.r, width: diameter, height: diameter }}><strong>{item.name.slice(0, 7)}</strong>{compact ? null : <span>{change}</span>}</button>;
      })}
    </div>
  </div>;
}
