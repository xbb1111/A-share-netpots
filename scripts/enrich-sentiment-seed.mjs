import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { SENTIMENT_SEED_META, SENTIMENT_SEED_ROWS } from '../server/sentiment-seed.mjs';
import { chinaDateFromUnix, getIndustryMappingProfile, selectTopicalThemes, toLevelOneIndustry } from './sentiment-taxonomy.mjs';

const EASTMONEY_TOKEN = 'bd1d9ddb04089700cf9c27f6f7426281';
const UNIVERSE = 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:0+t:81+s:2048';
const HISTORY_DAYS = 285;
const TARGET_DAYS = 252;
const CONCURRENCY = 36;
const MINIMUM_COVERAGE = 0.8;

console.log('loading independent market calendar');
const indexHistory = await fetchTencentIndexHistory();
const targetDates = indexHistory.map((row) => row.date).slice(-TARGET_DAYS);
const targetSet = new Set(targetDates);
const aggregates = new Map(targetDates.map((date) => [date, createAggregate()]));
const existingByDate = new Map(SENTIMENT_SEED_ROWS.map((row) => [row.date, row]));

console.log('loading current stock universe and themes');
const [metadata, themeSnapshot] = await Promise.all([fetchStockUniverse(), fetchThemeSnapshot()]);
const metadataByCode = new Map(metadata.map((stock) => [stock.code, stock]));
const mappingProfile = getIndustryMappingProfile(metadata.map((stock) => stock.industryLevelTwo));
if (mappingProfile.coverage < 0.98 || mappingProfile.unmapped.length) {
  throw new Error(`insufficient SW level-one mapping coverage: ${(mappingProfile.coverage * 100).toFixed(2)}%; unmapped ${mappingProfile.unmapped.join(', ')}`);
}
let completed = 0;
await concurrentMap(metadata, CONCURRENCY, async (stock) => {
  const rows = await fetchTencentHistory(stock.code);
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!targetSet.has(row.date)) continue;
    const aggregate = aggregates.get(row.date);
    if (Number.isFinite(row.turnover) && Number.isFinite(row.freeMarketCap) && row.freeMarketCap > 0) {
      aggregate.turnoverWeighted += row.turnover * row.freeMarketCap;
      aggregate.turnoverWeight += row.freeMarketCap;
    }
    if (Number.isFinite(row.amount) && row.amount >= 0) {
      aggregate.totalAmount += row.amount;
      if (stock.industry) aggregate.industryAmounts.set(stock.industry, (aggregate.industryAmounts.get(stock.industry) ?? 0) + row.amount);
    }
    if (index > 0 && Number.isFinite(row.close) && Number.isFinite(rows[index - 1].close) && rows[index - 1].close > 0) {
      const changePercent = ((row.close / rows[index - 1].close) - 1) * 100;
      aggregate.risingValid += 1;
      if (changePercent > 0) {
        aggregate.rising += 1;
        if (changePercent <= 5) aggregate.rising0To5 += 1;
        else if (changePercent <= 10) aggregate.rising5To10 += 1;
        else aggregate.risingAbove10 += 1;
      }
    }
    if (index >= 19 && Number.isFinite(row.close)) {
      const window = rows.slice(index - 19, index + 1).map((item) => item.close);
      if (window.length === 20 && window.every(Number.isFinite)) {
        aggregate.ma20Valid += 1;
        if (row.close > window.reduce((sum, value) => sum + value, 0) / 20) aggregate.aboveMa20 += 1;
      }
    }
  }
  completed += 1;
  if (completed % 500 === 0 || completed === metadata.length) console.log(`tencent history ${completed}/${metadata.length}`);
});

const minimumDailyStocks = Math.floor(metadata.length * MINIMUM_COVERAGE);
const coveredDates = targetDates.filter((date) => {
  const aggregate = aggregates.get(date);
  return aggregate.risingValid >= minimumDailyStocks
    && aggregate.ma20Valid >= minimumDailyStocks
    && aggregate.industryAmounts.size >= 20
    && aggregate.totalAmount > 0;
});
if (coveredDates.length < 200 || coveredDates.at(-1) !== targetDates.at(-1)) {
  throw new Error(`insufficient Tencent history: ${coveredDates.length}/${targetDates.length} dates meet ${MINIMUM_COVERAGE * 100}% coverage`);
}

const commonAsOf = targetDates.at(-1);
const currentAggregate = aggregates.get(commonAsOf);
const coveredDateSet = new Set(coveredDates);
const [marginRows, yieldRows, indexMeta] = await Promise.all([
  fetchMarginHistory(),
  fetchYieldHistory(targetDates[0], targetDates.at(-1)),
  fetchIndexMeta(),
]);
const marginByDate = new Map(marginRows.map((row) => [row.date, row.rzmre]));
const yieldByDate = new Map(yieldRows.map((row) => [row.date, row.tenYear]));
const indexByDate = new Map(indexHistory.map((row) => [row.date, row]));
const currentIndex = indexHistory.at(-1);

const enrichedRows = targetDates.map((date) => {
  const previous = existingByDate.get(date);
  const aggregate = aggregates.get(date);
  if (!coveredDateSet.has(date)) return previous;
  const index = indexByDate.get(date);
  const marginBuyAmount = marginByDate.get(date);
  const yield10y = nearestOnOrBefore(yieldByDate, date);
  const estimatedPe = indexMeta.peDynamic * (index.close / currentIndex.close);
  return {
    ...previous,
    date,
    turnover: Number.isFinite(previous?.turnover) ? previous.turnover : round(aggregate.turnoverWeighted / aggregate.turnoverWeight, 4),
    risingShare: round((aggregate.rising / aggregate.risingValid) * 100, 4),
    rising0To5Share: round((aggregate.rising0To5 / aggregate.risingValid) * 100, 4),
    rising5To10Share: round((aggregate.rising5To10 / aggregate.risingValid) * 100, 4),
    risingAbove10Share: round((aggregate.risingAbove10 / aggregate.risingValid) * 100, 4),
    aboveMa20Share: round((aggregate.aboveMa20 / aggregate.ma20Valid) * 100, 4),
    marginBuyShare: Number.isFinite(previous?.marginBuyShare) ? previous.marginBuyShare : round((marginBuyAmount / aggregate.totalAmount) * 100, 4),
    erp: Number.isFinite(previous?.erp) ? previous.erp : round((100 / estimatedPe) - yield10y, 4),
    ...buildIndustryBreakdown(aggregate),
  };
}).filter((row) => row && ['turnover', 'top3IndustryShare', 'totalAmountYi', 'risingShare', 'rising0To5Share', 'rising5To10Share', 'risingAbove10Share', 'aboveMa20Share', 'marginBuyShare', 'erp'].every((key) => Number.isFinite(row[key])));

const alignedAsOf = enrichedRows.at(-1)?.date;
if (!alignedAsOf) throw new Error('no fully aligned sentiment row was generated');
const dataLagTradingDays = Math.max(0, targetDates.length - 1 - targetDates.indexOf(alignedAsOf));

const meta = {
  ...SENTIMENT_SEED_META,
  generatedAt: new Date().toISOString(),
  universeSize: metadata.length,
  commonAsOf: alignedAsOf,
  marketAsOf: commonAsOf,
  dataLagTradingDays,
  industryClassification: '申万一级（由东方财富申万二级标签映射）',
  industryMappingCoverage: round(mappingProfile.coverage * 100, 2),
  themeAsOf: themeSnapshot.asOf,
  topThemes: themeSnapshot.items,
  note: '公开数据代理口径；行业成交额按申万一级互斥归类，主题榜独立展示且不计入占比；东方财富主路径不可用时，行情广度、MA20、成交集中度与换手率使用腾讯历史行情回填。',
};
const output = `// Generated by sentiment seed scripts from public market sources.\nexport const SENTIMENT_SEED_ROWS = ${JSON.stringify(enrichedRows)};\nexport const SENTIMENT_SEED_META = ${JSON.stringify(meta)};\n`;
await writeFile(resolve('server/sentiment-seed.mjs'), output, 'utf8');
console.log(`enriched ${coveredDates.length}/${targetDates.length} covered dates; aligned date ${alignedAsOf}; market date ${commonAsOf}; industries ${currentAggregate.industryAmounts.size}`);

function createAggregate() {
  return { turnoverWeighted: 0, turnoverWeight: 0, rising: 0, rising0To5: 0, rising5To10: 0, risingAbove10: 0, risingValid: 0, aboveMa20: 0, ma20Valid: 0, totalAmount: 0, industryAmounts: new Map() };
}

function buildIndustryBreakdown(aggregate) {
  const topEntries = [...aggregate.industryAmounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  const top3Amount = topEntries.reduce((sum, [, amount]) => sum + amount, 0);
  return {
    top3IndustryShare: round((top3Amount / aggregate.totalAmount) * 100, 4),
    top3Industries: topEntries.map(([name, amount]) => ({
      name,
      amountYi: round(amount / 100_000_000, 2),
      share: round((amount / aggregate.totalAmount) * 100, 2),
    })),
    totalAmountYi: round(aggregate.totalAmount / 100_000_000, 2),
    amountEstimated: true,
  };
}

async function fetchStockUniverse() {
  const first = await fetchStockPage(1);
  const pages = Math.ceil(first.total / 100);
  const rest = await concurrentMap(Array.from({ length: pages - 1 }, (_, index) => index + 2), 3, fetchStockPage);
  return [first, ...rest]
    .flatMap((page) => page.rows)
    .filter((row) => /^\d{6}$/.test(String(row.f12)) && !/ST|退/.test(String(row.f14 ?? '')))
    .map((row) => ({
      code: String(row.f12),
      industryLevelTwo: String(row.f100 ?? '').trim(),
      industry: toLevelOneIndustry(row.f100),
      currentPrice: number(row.f2),
      freeMarketCap: number(row.f21),
    }));
}

async function fetchThemeSnapshot() {
  const first = await fetchThemePage(1);
  const pages = Math.ceil(first.total / 100);
  const rest = await concurrentMap(Array.from({ length: pages - 1 }, (_, index) => index + 2), 3, fetchThemePage);
  const rows = [first, ...rest].flatMap((page) => page.rows);
  return {
    asOf: chinaDateFromUnix(Math.max(...rows.map((row) => number(row.f124)).filter(Number.isFinite))),
    items: selectTopicalThemes(rows.map((row) => ({ name: String(row.f14 ?? '').trim(), amount: number(row.f6) }))),
  };
}

async function fetchThemePage(page) {
  const url = new URL('https://push2delay.eastmoney.com/api/qt/clist/get');
  setParams(url, { pn: page, pz: 100, po: 1, np: 1, ut: EASTMONEY_TOKEN, fltt: 2, invt: 2, fid: 'f6', fs: 'm:90+t:3+f:!50', fields: 'f12,f14,f6,f124' });
  const payload = await fetchJson(url, 3);
  return { total: payload.data?.total ?? 0, rows: payload.data?.diff ?? [] };
}

async function fetchStockPage(page) {
  const url = new URL('https://push2delay.eastmoney.com/api/qt/clist/get');
  setParams(url, { pn: page, pz: 100, po: 1, np: 1, ut: EASTMONEY_TOKEN, fltt: 2, invt: 2, fid: 'f20', fs: UNIVERSE, fields: 'f2,f12,f14,f21,f100' });
  const payload = await fetchJson(url, 3);
  return { total: payload.data?.total ?? 0, rows: payload.data?.diff ?? [] };
}

async function fetchTencentHistory(code) {
  const prefix = /^[569]/.test(code) ? 'sh' : 'sz';
  const symbol = `${prefix}${code}`;
  const url = new URL('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get');
  url.searchParams.set('param', `${symbol},day,,,${HISTORY_DAYS},qfq`);
  const payload = await fetchJson(url, 2).catch(() => ({}));
  const security = payload.data?.[symbol] ?? {};
  const rows = security.qfqday ?? security.day ?? [];
  const volumeMultiplier = code.startsWith('688') ? 1 : 100;
  const stock = metadataByCode.get(code);
  const freeFloatShares = Number.isFinite(stock?.freeMarketCap) && Number.isFinite(stock?.currentPrice) && stock.currentPrice > 0
    ? stock.freeMarketCap / stock.currentPrice
    : null;
  return rows.map((row) => {
    const prices = [number(row[1]), number(row[2]), number(row[3]), number(row[4])].filter(Number.isFinite);
    const volumeUnits = number(row[5]);
    const averagePrice = prices.length ? prices.reduce((sum, value) => sum + value, 0) / prices.length : null;
    const close = number(row[2]);
    const volumeShares = Number.isFinite(volumeUnits) ? volumeUnits * volumeMultiplier : null;
    return {
      date: String(row[0]),
      close,
      amount: Number.isFinite(averagePrice) && Number.isFinite(volumeShares) ? averagePrice * volumeShares : null,
      turnover: Number.isFinite(volumeShares) && Number.isFinite(freeFloatShares) && freeFloatShares > 0 ? (volumeShares / freeFloatShares) * 100 : null,
      freeMarketCap: Number.isFinite(freeFloatShares) && Number.isFinite(close) ? freeFloatShares * close : null,
    };
  });
}

async function fetchTencentIndexHistory() {
  const symbol = 'sz399317';
  const url = new URL('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get');
  url.searchParams.set('param', `${symbol},day,,,${HISTORY_DAYS},qfq`);
  const payload = await fetchJson(url, 3);
  const security = payload.data?.[symbol] ?? {};
  const rows = security.qfqday ?? security.day ?? [];
  const history = rows.map((row) => ({ date: String(row[0]), close: number(row[2]) })).filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.close));
  if (history.length < TARGET_DAYS) throw new Error(`insufficient independent market calendar: ${history.length} dates`);
  return history;
}

async function fetchIndexMeta() {
  const payload = await fetchJson('https://www.cnindex.com.cn/index/indexList?channelCode=205&rows=20&pageNum=1');
  const row = payload.data?.rows?.find((item) => item.indexcode === '399317');
  if (!Number.isFinite(number(row?.peDynamic))) throw new Error('CNI A-share PE unavailable');
  return { peDynamic: number(row.peDynamic) };
}

async function fetchMarginHistory() {
  const url = new URL('https://datacenter-web.eastmoney.com/api/data/v1/get');
  setParams(url, { reportName: 'RPTA_RZRQ_LSHJ', columns: 'DIM_DATE,RZMRE', source: 'WEB', pageNumber: 1, pageSize: 500, sortColumns: 'dim_date', sortTypes: -1 });
  const payload = await fetchJson(url, 3);
  return (payload.result?.data ?? []).map((row) => ({ date: String(row.DIM_DATE).slice(0, 10), rzmre: number(row.RZMRE) })).filter((row) => Number.isFinite(row.rzmre));
}

async function fetchYieldHistory(startDate, endDate) {
  const rows = [];
  for (let page = 1; page <= 3; page += 1) {
    const url = new URL('https://datacenter.eastmoney.com/api/data/get');
    setParams(url, { type: 'RPTA_WEB_TREASURYYIELD', sty: 'ALL', st: 'SOLAR_DATE', sr: -1, token: '894050c76af8597a853f5b408b759f5d', p: page, ps: 500, pageNo: page, pageNum: page });
    const payload = await fetchJson(url, 3);
    const pageRows = payload.result?.data ?? [];
    rows.push(...pageRows);
    if (pageRows.some((row) => String(row.SOLAR_DATE).slice(0, 10) <= startDate) || pageRows.length < 500) break;
  }
  return rows.map((row) => ({ date: String(row.SOLAR_DATE).slice(0, 10), tenYear: number(row.EMM00166466) })).filter((row) => row.date >= startDate && row.date <= endDate && Number.isFinite(row.tenYear));
}

function nearestOnOrBefore(map, date) {
  const key = [...map.keys()].filter((item) => item <= date).sort().at(-1);
  return key ? map.get(key) : null;
}

async function fetchJson(input, retries = 1) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      const response = await fetch(input, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'Mozilla/5.0', Referer: 'https://quote.eastmoney.com/' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise((resolveDelay) => setTimeout(resolveDelay, 250 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function concurrentMap(items, concurrency, mapper) {
  const results = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next; next += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

function setParams(url, values) { Object.entries(values).forEach(([key, value]) => url.searchParams.set(key, String(value))); }
function number(value) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function round(value, digits) { if (!Number.isFinite(value)) return null; const factor = 10 ** digits; return Math.round(value * factor) / factor; }
