export type IndustryMarketMetric = 'heat' | 'change';
export type IndustryMarketTone = 'up' | 'down' | 'flat';

type MarketBoard = {
  code: string;
  name: string;
  heat: number;
  change: number;
  level?: number;
  parentCode?: string;
  capitalFlow?: number;
};

export type IndustryMarketGroup = { id: string; name: string; x: number; y: number; width: number; height: number };
export type IndustryMarketItem = MarketBoard & { groupId: string; groupName: string; x: number; y: number; r: number; tone: IndustryMarketTone; featured: boolean };
export type IndustryMarketMap = { groups: IndustryMarketGroup[]; items: IndustryMarketItem[]; bounds: { width: number; height: number } };

const NAME_GROUPS: Array<[string, string[]]> = [
  ['金融', ['银行', '证券', '保险', '多元金融']],
  ['信息技术', ['软件', '计算机', '半导体', '通信', '电子', '互联网']],
  ['工业制造', ['机械', '设备', '汽车', '军工', '航天', '运输']],
  ['消费', ['食品', '饮料', '零售', '家电', '纺织', '旅游', '酒店']],
  ['医药健康', ['医药', '医疗', '生物', '护理']],
  ['能源材料', ['煤炭', '石油', '化工', '有色', '钢铁', '电力', '新能源']],
  ['地产基建', ['房地产', '建筑', '建材', '基建']],
];

function fallbackGroup(name: string): { id: string; name: string } {
  const match = NAME_GROUPS.find(([, keywords]) => keywords.some((keyword) => name.includes(keyword)));
  return match ? { id: `mapped-${match[0]}`, name: match[0] } : { id: 'other', name: '其他' };
}

function toneFor(change: number): IndustryMarketTone { return change > 0 ? 'up' : change < 0 ? 'down' : 'flat'; }

type PackedPoint = { x: number; y: number };

function packCluster(radii: number[]) {
  const gap = 2; const maxRadius = Math.max(...radii, 1); const cellSize = maxRadius * 2 + gap;
  const points: PackedPoint[] = []; const grid = new Map<string, number[]>(); let candidateChecks = 0;
  const key = (x: number, y: number) => `${x}:${y}`;
  const addToGrid = (point: PackedPoint, index: number) => {
    const gx = Math.floor(point.x / cellSize); const gy = Math.floor(point.y / cellSize); const id = key(gx, gy);
    const bucket = grid.get(id) ?? []; bucket.push(index); grid.set(id, bucket);
  };
  const fits = (point: PackedPoint, radius: number) => {
    const gx = Math.floor(point.x / cellSize); const gy = Math.floor(point.y / cellSize);
    for (let x = gx - 1; x <= gx + 1; x += 1) for (let y = gy - 1; y <= gy + 1; y += 1) {
      for (const otherIndex of grid.get(key(x, y)) ?? []) {
        candidateChecks += 1;
        const other = points[otherIndex];
        if (Math.hypot(point.x - other.x, point.y - other.y) < radius + radii[otherIndex] + gap) return false;
      }
    }
    return true;
  };
  radii.forEach((radius, index) => {
    if (index === 0) { points.push({ x: 0, y: 0 }); addToGrid(points[0], 0); return; }
    let point: PackedPoint | null = null;
    const startStep = Math.max(1, index * 2);
    for (let step = startStep; step <= startStep + 8000; step += 1) {
      const angle = step * 2.399963229728653 + index * .173;
      const distance = Math.max(4, maxRadius * .34) * Math.sqrt(step);
      const candidate = { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance };
      if (fits(candidate, radius)) { point = candidate; break; }
    }
    if (!point) point = { x: (Math.max(...points.map((item, placedIndex) => item.x + radii[placedIndex])) || 0) + radius + gap, y: 0 };
    points.push(point); addToGrid(point, index);
  });
  const minX = Math.min(...points.map((point, index) => point.x - radii[index]));
  const maxX = Math.max(...points.map((point, index) => point.x + radii[index]));
  const minY = Math.min(...points.map((point, index) => point.y - radii[index]));
  const maxY = Math.max(...points.map((point, index) => point.y + radii[index]));
  return { points, width: maxX - minX, height: maxY - minY, minX, minY, candidateChecks };
}

export function buildIndustryMarketMapWithStats<T extends MarketBoard>(boards: T[], metric: IndustryMarketMetric, width: number, height: number): { map: IndustryMarketMap; candidateChecks: number } {
  const bounds = { width: Math.max(640, width), height: Math.max(360, height) };
  if (!boards.length) return { map: { groups: [], items: [], bounds }, candidateChecks: 0 };
  const byCode = new Map(boards.map((board) => [board.code, board]));
  const groupFor = (board: T) => {
    let current: MarketBoard | undefined = board;
    const seen = new Set<string>();
    while (current?.parentCode && !seen.has(current.code)) { seen.add(current.code); current = byCode.get(current.parentCode); }
    return current && current.level === 1 ? { id: current.code, name: current.name } : fallbackGroup(board.name);
  };
  const buckets = new Map<string, { name: string; boards: T[] }>();
  for (const board of [...boards].sort((a, b) => a.code.localeCompare(b.code))) {
    const group = groupFor(board); const bucket = buckets.get(group.id) ?? { name: group.name, boards: [] };
    bucket.boards.push(board); buckets.set(group.id, bucket);
  }
  const entries = [...buckets.entries()].sort(([a], [b]) => a.localeCompare(b));
  const groups: IndustryMarketGroup[] = []; const items: IndustryMarketItem[] = [];
  const allValues = boards.map((board) => metric === 'heat' ? Math.max(0, board.heat) : Math.abs(board.change));
  const maxValue = Math.max(...allValues, 1);
  const metricValue = (board: MarketBoard) => metric === 'heat' ? Math.max(0, board.heat) : Math.abs(board.change);
  const featured = new Set([...boards].sort((a, b) => metricValue(b) - metricValue(a) || a.code.localeCompare(b.code)).slice(0, 3).map((b) => b.code));
  const radiusFor = (board: MarketBoard) => 8 + 54 * Math.sqrt((metric === 'heat' ? Math.max(0, board.heat) : Math.abs(board.change)) / maxValue);
  const ordered = [...boards].sort((a, b) => radiusFor(b) - radiusFor(a) || a.code.localeCompare(b.code));
  const radii = ordered.map(radiusFor); const packed = packCluster(radii); const outer = 18;
  const clusterScale = Math.min(1, (bounds.width - outer * 2) / packed.width);
  const scaledWidth = packed.width * clusterScale; const scaledHeight = packed.height * clusterScale;
  bounds.height = Math.max(bounds.height, Math.ceil(scaledHeight + outer * 2));
  const offsetX = outer + Math.max(0, (bounds.width - scaledWidth - outer * 2) / 2);
  const offsetY = outer + Math.max(0, (bounds.height - scaledHeight - outer * 2) / 2);
  const groupNames = new Map(entries.map(([id, bucket]) => [id, bucket.name]));
  entries.forEach(([id, bucket]) => groups.push({ id, name: bucket.name, x: 0, y: 0, width: bounds.width, height: bounds.height }));
  ordered.forEach((board, index) => {
    const group = groupFor(board); const point = packed.points[index];
    items.push({ ...board, groupId: group.id, groupName: groupNames.get(group.id) ?? group.name, x: (point.x - packed.minX) * clusterScale + offsetX, y: (point.y - packed.minY) * clusterScale + offsetY, r: radii[index] * clusterScale, tone: toneFor(board.change), featured: featured.has(board.code) });
  });
  return { map: { groups, items, bounds }, candidateChecks: packed.candidateChecks };
}

export function buildIndustryMarketMap<T extends MarketBoard>(boards: T[], metric: IndustryMarketMetric, width: number, height: number): IndustryMarketMap {
  return buildIndustryMarketMapWithStats(boards, metric, width, height).map;
}
