import { useMemo } from 'react';
import type { IndustryBoard } from '../data/types';
import { buildIndustryMarketMap, type IndustryMarketMetric } from '../data/industryMarketMap';

export function IndustryMarketMap({ boards, metric, onActivate }: { boards: IndustryBoard[]; metric: IndustryMarketMetric; onActivate: (board: IndustryBoard) => void }) {
  const height = 440;
  const layout = useMemo(() => buildIndustryMarketMap(boards, metric, 920, height), [boards, metric, height]);
  const boardsByCode = useMemo(() => new Map(boards.map((board) => [board.code, board])), [boards]);
  const groupLabelIds = useMemo(() => new Map(layout.groups.map((group, index) => [group.id, `industry-market-group-${index}`])), [layout.groups]);
  return <div className="industry-market-map" aria-label="分组行业行情星群">
    <div className="industry-market-map__canvas" style={{ width: layout.bounds.width, height: layout.bounds.height }}>
      <div className="sr-only">{layout.groups.map((group) => <span id={groupLabelIds.get(group.id)} className="industry-market-map__group-label" key={group.id}>{group.name}</span>)}</div>
      {layout.items.map((item, index) => {
        const board = boardsByCode.get(item.code)!;
        const change = `${item.change >= 0 ? '+' : ''}${item.change.toFixed(2)}%`;
        const flow = Number.isFinite(item.capitalFlow) ? ` 资金流 ${item.capitalFlow! >= 0 ? '+' : ''}${item.capitalFlow!.toFixed(2)} 亿` : '';
        const description = `${item.name} ${item.code} 涨跌幅 ${change} 热度 ${item.heat}${flow}`;
        const diameter = item.r * 2;
        const compact = item.r < 20;
        return <button type="button" key={item.code} title={description} aria-label={description} aria-describedby={groupLabelIds.get(item.groupId)} onClick={() => onActivate(board)} className={`industry-market-map__item industry-market-map__item--${item.tone}${item.featured ? ' industry-market-map__item--featured' : ''}${compact ? ' industry-market-map__item--compact' : ''}`} style={{ left: item.x - item.r, top: item.y - item.r, width: diameter, height: diameter, animationDelay: `${Math.min(index, 40) * 8}ms` }}><strong>{item.name.slice(0, 7)}</strong>{compact ? null : <span>{change}</span>}</button>;
      })}
    </div>
  </div>;
}
