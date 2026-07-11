export type BubbleMetric = 'heat' | 'change';
export type IndustryBubble = { code: string; x: number; y: number; r: number; tone: 'up' | 'down' | 'flat' };

export function buildIndustryBubbles<T extends { code: string; heat: number; change: number }>(boards: T[], metric: BubbleMetric, width: number, height: number): IndustryBubble[] {
  const sorted = [...boards].sort((left, right) => right[metric] - left[metric] || left.code.localeCompare(right.code));
  const raw = sorted.map((board) => metric === 'heat' ? Math.max(0, board.heat) : Math.abs(board.change));
  const max = Math.max(...raw, 1);
  const maxRadius = Math.max(18, Math.min(52, Math.min(width, height) / 5));
  const radii = raw.map((value) => 14 + Math.sqrt(value / max) * (maxRadius - 14));
  const cell = maxRadius * 2 + 8;
  const columns = Math.max(1, Math.floor((width - 16) / cell));
  return sorted.map((board, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return { code: board.code, x: 16 + maxRadius + column * cell, y: 16 + maxRadius + row * cell, r: radii[index], tone: board.change > 0 ? 'up' : board.change < 0 ? 'down' : 'flat' };
  });
}
