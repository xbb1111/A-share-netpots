export const LARGE_CAPITAL_ETFS = [
  { code: '510050', name: '华夏上证50ETF', indexId: 'sse50', indexName: '上证50', exchange: 'SSE' },
  { code: '510300', name: '华泰柏瑞沪深300ETF', indexId: 'csi300', indexName: '沪深300', exchange: 'SSE' },
  { code: '510310', name: '易方达沪深300ETF', indexId: 'csi300', indexName: '沪深300', exchange: 'SSE' },
  { code: '510330', name: '华夏沪深300ETF', indexId: 'csi300', indexName: '沪深300', exchange: 'SSE' },
  { code: '159919', name: '嘉实沪深300ETF', indexId: 'csi300', indexName: '沪深300', exchange: 'SZSE' },
  { code: '510500', name: '南方中证500ETF', indexId: 'csi500', indexName: '中证500', exchange: 'SSE' },
  { code: '512100', name: '南方中证1000ETF', indexId: 'csi1000', indexName: '中证1000', exchange: 'SSE' },
  { code: '159845', name: '华夏中证1000ETF', indexId: 'csi1000', indexName: '中证1000', exchange: 'SZSE' },
  { code: '560010', name: '广发中证1000ETF', indexId: 'csi1000', indexName: '中证1000', exchange: 'SSE' },
  { code: '159629', name: '富国中证1000ETF', indexId: 'csi1000', indexName: '中证1000', exchange: 'SZSE' },
  { code: '588080', name: '易方达上证科创板50ETF', indexId: 'star50', indexName: '科创50', exchange: 'SSE' },
  { code: '159915', name: '易方达创业板ETF', indexId: 'chinext', indexName: '创业板', exchange: 'SZSE' },
];

export const LARGE_CAPITAL_EVENTS = [
  {
    date: '2025-04-07',
    title: '中央汇金公告增持 ETF',
    summary: '中央汇金确认已再次增持交易型开放式指数基金，并表示未来将继续增持。',
    source: '中央汇金投资有限责任公司',
    url: 'https://www.huijin-inv.cn/huijin-inv/SC20252/Information_Center.shtml',
  },
  {
    date: '2025-06-03',
    title: '中央汇金再次公告增持 ETF',
    summary: '官方再次确认增持 ETF；公告未披露日频交易明细。',
    source: '中央汇金投资有限责任公司',
    url: 'https://www.huijin-inv.cn/huijin-inv/SC20252/Information_Center.shtml',
  },
];

const numberOrNull = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const round = (value, digits = 4) => Number.isFinite(value) ? Number(value.toFixed(digits)) : null;

export function normalizeMemberName(value) {
  return String(value ?? '')
    .replace(/[（(]\s*代客\s*[）)]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export function parseCffexCsv(text, product) {
  const rows = [];
  for (const line of String(text).replace(/^\uFEFF/, '').split(/\r?\n/).slice(2)) {
    if (!line.trim()) continue;
    const columns = parseCsvLine(line);
    if (columns.length < 12 || !/^\d{8}$/.test(columns[0])) continue;
    const contract = columns[1].trim().toUpperCase();
    if (!contract.startsWith(product)) continue;
    rows.push({
      date: compactDate(columns[0]),
      product,
      contract,
      rank: numberOrNull(columns[2]),
      volumeMember: normalizeMemberName(columns[3]),
      volume: numberOrNull(columns[4]),
      volumeChange: numberOrNull(columns[5]),
      longMember: normalizeMemberName(columns[6]),
      long: numberOrNull(columns[7]),
      longChange: numberOrNull(columns[8]),
      shortMember: normalizeMemberName(columns[9]),
      short: numberOrNull(columns[10]),
      shortChange: numberOrNull(columns[11]),
    });
  }
  return rows;
}

export function aggregateCffexDay(rows, product, date) {
  const members = new Map();
  for (const row of rows) {
    mergeMemberSide(members, row.longMember, 'long', row.long, row.longChange);
    mergeMemberSide(members, row.shortMember, 'short', row.short, row.shortChange);
  }
  const memberRows = [...members.values()].map((member) => ({
    ...member,
    net: member.long - member.short,
    netChange: member.longChange - member.shortChange,
    qualityFlags: [
      ...(!member.hasLong ? ['long-not-in-disclosed-ranking'] : []),
      ...(!member.hasShort ? ['short-not-in-disclosed-ranking'] : []),
    ],
  })).sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

  const tiers = {};
  for (const limit of [5, 10, 20]) {
    const selected = rows.filter((row) => row.rank <= limit);
    const long = sum(selected.map((row) => row.long));
    const short = sum(selected.map((row) => row.short));
    const longChange = sum(selected.map((row) => row.longChange));
    const shortChange = sum(selected.map((row) => row.shortChange));
    tiers[`top${limit}`] = {
      long,
      short,
      net: long - short,
      longChange,
      shortChange,
      netChange: longChange - shortChange,
      longShortRatio: short > 0 ? round(long / short) : null,
    };
  }
  return { date, product, contracts: [...new Set(rows.map((row) => row.contract))].sort(), tiers, members: memberRows };
}

export function buildLargeCapitalSnapshot({ generatedAt = new Date().toISOString(), etfs = [], institutionDays = [] }) {
  const processedEtfs = etfs.map(processEtf).filter((item) => item.series.length);
  const dateSet = new Set(processedEtfs.flatMap((item) => item.series.map((point) => point.date)));
  const dates = [...dateSet].sort().slice(-252);
  const groupDefinitions = [
    { id: 'all', name: '核心宽基合计' },
    ...uniqueBy(processedEtfs.map((item) => ({ id: item.indexId, name: item.indexName })), (item) => item.id),
  ];
  const indexGroups = groupDefinitions.map((group) => ({
    ...group,
    series: dates.map((date) => aggregateEtfGroupPoint(processedEtfs, group.id, date)).filter((point) => point.coverage > 0),
  }));
  const allSeries = indexGroups.find((group) => group.id === 'all')?.series ?? [];
  const nationalAsOf = allSeries.at(-1)?.date ?? null;

  const productMap = new Map();
  for (const day of institutionDays) {
    if (!productMap.has(day.product)) productMap.set(day.product, []);
    productMap.get(day.product).push(day);
  }
  const products = ['IF', 'IH', 'IC', 'IM'].map((id) => buildInstitutionProduct(id, productMap.get(id) ?? []));
  const institutionAsOf = products.map((item) => item.asOf).filter(Boolean).sort().at(-1) ?? null;
  const asOf = [nationalAsOf, institutionAsOf].filter(Boolean).sort().at(-1) ?? null;
  const stale = isStale(asOf, generatedAt, 7);

  return {
    version: 1,
    asOf,
    updatedAt: generatedAt,
    stale,
    status: deriveStatus(allSeries, products),
    methodology: 'ETF 净申购为份额变化×当日单位净值的代理估算；期指为中金所前20会员席位披露汇总。',
    nationalTeam: {
      asOf: nationalAsOf,
      label: '核心宽基 ETF 资金代理信号',
      disclaimer: 'ETF 日频净申购包含所有投资者，不能直接认定为国家队买卖；官方公告与代理序列分开展示。',
      source: '上海证券交易所、深圳证券交易所、天天基金公开净值、东方财富公开行情',
      summaries: { day1: sumTail(allSeries, 1), day5: sumTail(allSeries, 5), day20: sumTail(allSeries, 20) },
      indexGroups,
      etfs: processedEtfs,
      events: LARGE_CAPITAL_EVENTS,
      qualityFlags: processedEtfs.length < LARGE_CAPITAL_ETFS.length ? ['partial-etf-coverage'] : [],
    },
    institutions: {
      asOf: institutionAsOf,
      label: '中金所会员席位披露',
      disclaimer: '期货公司排名是经纪业务席位汇总，不代表期货公司自营仓位；未进入单边前20不等于持仓为零。',
      source: '中国金融期货交易所成交持仓排名',
      products,
      qualityFlags: products.some((item) => !item.asOf) ? ['partial-product-coverage'] : [],
    },
  };
}

export function withLargeCapitalFreshness(seed, now = new Date()) {
  const next = structuredClone(seed);
  next.stale = isStale(next.asOf, now.toISOString(), 7);
  return next;
}

function processEtf(raw) {
  const meta = LARGE_CAPITAL_ETFS.find((item) => item.code === raw.code) ?? raw;
  const sorted = [...(raw.series ?? [])].sort((a, b) => a.date.localeCompare(b.date)).slice(-253);
  const series = sorted.map((point, index) => {
    const nav = numberOrNull(point.nav);
    const shares = numberOrNull(point.shares);
    const previous = sorted[index - 1];
    const previousShares = numberOrNull(previous?.shares);
    const previousNav = numberOrNull(previous?.nav);
    const shareChange = shares !== null && previousShares !== null ? shares - previousShares : null;
    const aum = shares !== null && nav !== null ? shares * nav : null;
    const previousAum = previousShares !== null && previousNav !== null ? previousShares * previousNav : null;
    const sharePct = shareChange !== null && previousShares ? shareChange / previousShares : null;
    const aumPct = aum !== null && previousAum ? aum / previousAum - 1 : null;
    const splitSuspect = Number.isFinite(sharePct) && Math.abs(sharePct) >= .5 && Number.isFinite(aumPct) && Math.abs(aumPct) <= .05;
    const qualityFlags = [
      ...(nav === null ? ['missing-nav'] : []),
      ...(shares === null ? ['missing-shares'] : []),
      ...(splitSuspect ? ['split-suspect'] : []),
    ];
    return {
      date: point.date,
      nav,
      shares,
      shareChange: round(shareChange, 2),
      aumYi: aum === null ? null : round(aum / 1e8, 4),
      netFlowYi: shareChange === null || nav === null || splitSuspect ? null : round(shareChange * nav / 1e8, 4),
      amountYi: numberOrNull(point.amount) === null ? null : round(Number(point.amount) / 1e8, 4),
      qualityFlags,
    };
  }).slice(-252);
  const latest = series.at(-1) ?? {};
  return {
    code: raw.code,
    name: meta.name,
    indexId: meta.indexId,
    indexName: meta.indexName,
    exchange: meta.exchange,
    asOf: latest.date ?? null,
    nav: latest.nav ?? null,
    shares: latest.shares ?? null,
    shareChange: latest.shareChange ?? null,
    netFlowYi: latest.netFlowYi ?? null,
    amountYi: latest.amountYi ?? null,
    source: meta.exchange === 'SSE' ? '上海证券交易所基金份额' : '深圳证券交易所基金规模',
    methodology: '净申购估算=份额变化×当日单位净值；疑似拆分日排除。',
    qualityFlags: latest.qualityFlags ?? [],
    series,
  };
}

function buildInstitutionProduct(id, inputDays) {
  const days = [...inputDays].sort((a, b) => a.date.localeCompare(b.date));
  const summarySeries = days.slice(-252).map((day) => ({ date: day.date, contracts: day.contracts, ...day.tiers.top20 }));
  const memberDays = days.slice(-120);
  const histories = new Map();
  for (const day of memberDays) {
    for (const member of day.members) {
      if (!histories.has(member.name)) histories.set(member.name, []);
      histories.get(member.name).push({ date: day.date, long: member.long, short: member.short, net: member.net, netChange: member.netChange, qualityFlags: member.qualityFlags });
    }
  }
  const latest = days.at(-1);
  return {
    id,
    name: ({ IF: '沪深300股指期货', IH: '上证50股指期货', IC: '中证500股指期货', IM: '中证1000股指期货' })[id],
    asOf: latest?.date ?? null,
    contracts: latest?.contracts ?? [],
    latest: latest?.tiers ?? null,
    summarySeries,
    members: (latest?.members ?? []).map((member) => ({ ...member, history: histories.get(member.name) ?? [] })),
    source: '中国金融期货交易所成交持仓排名',
    methodology: '同品种各合约前20披露席位加总；披露净头寸不等于完整账户净头寸。',
    qualityFlags: latest ? [] : ['missing-product-data'],
  };
}

function mergeMemberSide(map, name, side, value, change) {
  if (!name || !Number.isFinite(value)) return;
  const member = map.get(name) ?? { name, long: 0, short: 0, longChange: 0, shortChange: 0, hasLong: false, hasShort: false };
  member[side] += value;
  member[`${side}Change`] += Number.isFinite(change) ? change : 0;
  member[side === 'long' ? 'hasLong' : 'hasShort'] = true;
  map.set(name, member);
}

function aggregateEtfGroupPoint(etfs, groupId, date) {
  const members = etfs.filter((item) => groupId === 'all' || item.indexId === groupId);
  const points = members.map((item) => item.series.find((point) => point.date === date)).filter(Boolean);
  const valid = points.filter((point) => Number.isFinite(point.netFlowYi));
  return {
    date,
    netFlowYi: valid.length ? round(sum(valid.map((point) => point.netFlowYi))) : null,
    amountYi: round(sum(points.map((point) => point.amountYi))),
    coverage: valid.length,
    expected: members.length,
    qualityFlags: valid.length < members.length ? ['partial-coverage'] : [],
  };
}

function deriveStatus(allSeries, products) {
  const etf5 = sumTail(allSeries, 5);
  const institution5 = sum(products.map((product) => sumTail(product.summarySeries, 5, 'netChange')));
  if (!Number.isFinite(etf5) || !products.some((item) => item.summarySeries.length)) return '数据不足';
  if (etf5 > 0 && institution5 > 0) return '宽基流入与期指披露净多同步增强';
  if (etf5 < 0 && institution5 < 0) return '宽基流出与期指披露净空同步增强';
  if ((etf5 > 0) !== (institution5 > 0)) return '宽基与期指席位信号分化';
  return '中性';
}

function sumTail(series, count, field = 'netFlowYi') {
  const values = series.slice(-count).map((point) => point[field]).filter(Number.isFinite);
  return values.length ? round(sum(values)) : null;
}

function sum(values) { return values.filter(Number.isFinite).reduce((total, value) => total + value, 0); }
function uniqueBy(items, key) { return [...new Map(items.map((item) => [key(item), item])).values()]; }
function compactDate(value) { return `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`; }
function isStale(asOf, nowIso, calendarDays) { return !asOf || (new Date(nowIso).getTime() - new Date(`${asOf}T16:00:00+08:00`).getTime()) > calendarDays * 86400000; }

function parseCsvLine(line) {
  const result = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) { result.push(value); value = ''; }
    else value += character;
  }
  result.push(value);
  return result;
}
