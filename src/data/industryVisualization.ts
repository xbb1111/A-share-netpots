export type BubbleMetric = 'heat' | 'change';
export type IndustryBubble = { code: string; x: number; y: number; r: number; tone: 'up' | 'down' | 'flat' };
export type IndustryBubbleBounds = { width: number; height: number };

export function buildIndustryBubbles<T extends { code: string; heat: number; change: number }>(boards: T[], metric: BubbleMetric, width: number, height: number): IndustryBubble[] {
  const sorted = [...boards].sort((left, right) => right[metric] - left[metric] || left.code.localeCompare(right.code));
  if (sorted.length === 0) return [];
  const raw = sorted.map((board) => metric === 'heat' ? Math.max(0, board.heat) : Math.abs(board.change));
  const max = Math.max(...raw, 1);
  const maxRadius = Math.max(38, Math.min(72, Math.sqrt((width * height) / sorted.length) * 0.42));
  const minRadius = Math.max(17, Math.min(25, maxRadius * 0.42));
  const radii = raw.map((value, index) => {
    const intensity = Math.sqrt(value / max);
    const rank = sorted.length === 1 ? 1 : 1 - index / (sorted.length - 1);
    return minRadius + (intensity * 0.7 + rank * 0.3) * (maxRadius - minRadius);
  });
  const padding = 5;
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const placed: IndustryBubble[] = [];

  radii.forEach((radius, index) => {
    if (index === 0) {
      placed.push({ code: sorted[index].code, x: 0, y: 0, r: radius, tone: toneFor(sorted[index].change) });
      return;
    }
    let position: { x: number; y: number } | null = null;
    for (let step = 1; step < 100_000 && !position; step += 1) {
      const angle = step * goldenAngle;
      const distance = 3.8 * Math.sqrt(step) * Math.max(1, radius / 22);
      const candidate = { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
      const hasCollision = placed.some((bubble) => Math.hypot(candidate.x - bubble.x, candidate.y - bubble.y) < radius + bubble.r + padding);
      if (!hasCollision) position = candidate;
    }
    const fallbackDistance = placed.reduce((largest, bubble) => Math.max(largest, Math.hypot(bubble.x, bubble.y) + bubble.r), 0) + radius + padding;
    const point = position ?? { x: fallbackDistance, y: 0 };
    placed.push({ code: sorted[index].code, x: point.x, y: point.y, r: radius, tone: toneFor(sorted[index].change) });
  });

  const minX = Math.min(...placed.map((bubble) => bubble.x - bubble.r));
  const minY = Math.min(...placed.map((bubble) => bubble.y - bubble.r));
  return placed.map((bubble) => ({ ...bubble, x: bubble.x - minX + 30, y: bubble.y - minY + 30 }));
}

function toneFor(change: number): IndustryBubble['tone'] {
  return change > 0 ? 'up' : change < 0 ? 'down' : 'flat';
}

export function getIndustryBubbleBounds(bubbles: IndustryBubble[], padding = 30): IndustryBubbleBounds {
  if (bubbles.length === 0) return { width: 640, height: 320 };
  return {
    width: Math.ceil(Math.max(...bubbles.map((bubble) => bubble.x + bubble.r)) + padding),
    height: Math.ceil(Math.max(...bubbles.map((bubble) => bubble.y + bubble.r)) + padding),
  };
}
