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

export function buildIndustryMarketMap<T extends MarketBoard>(boards: T[], metric: IndustryMarketMetric, width: number, height: number): IndustryMarketMap {
  const bounds = { width: Math.max(640, width), height: Math.max(360, height) };
  if (!boards.length) return { groups: [], items: [], bounds };
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
  const columns = Math.min(3, Math.max(1, Math.ceil(Math.sqrt(entries.length * 1.35))));
  const rows = Math.ceil(entries.length / columns); const gap = 12; const outer = 12;
  const groupWidth = (bounds.width - outer * 2 - gap * (columns - 1)) / columns;
  const groups: IndustryMarketGroup[] = []; const items: IndustryMarketItem[] = [];
  const allValues = boards.map((board) => metric === 'heat' ? Math.max(0, board.heat) : Math.abs(board.change));
  const maxValue = Math.max(...allValues, 1); const featured = new Set([...boards].sort((a, b) => b.heat - a.heat || a.code.localeCompare(b.code)).slice(0, 3).map((b) => b.code));
  const radiusFor = (board: MarketBoard) => 20 + 16 * Math.sqrt((metric === 'heat' ? Math.max(0, board.heat) : Math.abs(board.change)) / maxValue);
  const desiredHeights = entries.map(([, bucket]) => {
    const occupiedArea = bucket.boards.reduce((sum, board) => sum + Math.PI * (radiusFor(board) + 3) ** 2, 0);
    return Math.max(180, 48 + occupiedArea * 2.25 / Math.max(100, groupWidth - 16));
  });
  const rowHeights = Array.from({ length: rows }, (_, row) => Math.max(...desiredHeights.slice(row * columns, (row + 1) * columns)));
  const contentHeight = outer * 2 + gap * (rows - 1) + rowHeights.reduce((sum, value) => sum + value, 0);
  bounds.height = Math.max(bounds.height, Math.ceil(contentHeight));
  entries.forEach(([id, bucket], groupIndex) => {
    const column = groupIndex % columns; const row = Math.floor(groupIndex / columns);
    const groupY = outer + rowHeights.slice(0, row).reduce((sum, value) => sum + value + gap, 0);
    const group = { id, name: bucket.name, x: outer + column * (groupWidth + gap), y: groupY, width: groupWidth, height: rowHeights[row] };
    groups.push(group);
    const usableTop = group.y + 32; const usableHeight = Math.max(30, group.height - 40);
    const radii = bucket.boards.map(radiusFor);
    const placed: Array<{ x: number; y: number; r: number }> = [];
    bucket.boards.forEach((board, index) => {
      const radius = radii[index]; let point = { x: group.x + group.width / 2, y: usableTop + usableHeight / 2 };
      for (let step = 0; step < 20000; step += 1) {
        const angle = step * 2.399963; const distance = 2.2 * Math.sqrt(step) * Math.max(1, radius / 10);
        const candidate = { x: group.x + group.width / 2 + Math.cos(angle) * distance, y: usableTop + usableHeight / 2 + Math.sin(angle) * distance };
        const inside = candidate.x - radius >= group.x + 5 && candidate.x + radius <= group.x + group.width - 5 && candidate.y - radius >= usableTop && candidate.y + radius <= usableTop + usableHeight;
        if (inside && placed.every((other) => Math.hypot(candidate.x - other.x, candidate.y - other.y) >= radius + other.r + 2)) { point = candidate; break; }
      }
      placed.push({ ...point, r: radius });
      items.push({ ...board, groupId: id, groupName: bucket.name, ...point, r: radius, tone: toneFor(board.change), featured: featured.has(board.code) });
    });
  });
  return { groups, items, bounds };
}
