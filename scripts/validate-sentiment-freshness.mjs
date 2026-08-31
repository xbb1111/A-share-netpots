import { SENTIMENT_SEED_META, SENTIMENT_SEED_ROWS } from '../server/sentiment-seed.mjs';

const symbol = 'sz399317';
const url = new URL('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get');
url.searchParams.set('param', `${symbol},day,,,20,qfq`);
const response = await fetch(url, { signal: AbortSignal.timeout(10_000), headers: { 'User-Agent': 'Mozilla/5.0' } });
if (!response.ok) throw new Error(`market calendar HTTP ${response.status}`);
const payload = await response.json();
const security = payload.data?.[symbol] ?? {};
const marketDates = (security.qfqday ?? security.day ?? []).map((row) => String(row[0])).filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date));
const commonAsOf = SENTIMENT_SEED_ROWS.at(-1)?.date ?? SENTIMENT_SEED_META.commonAsOf;
const position = marketDates.indexOf(commonAsOf);
if (position < 0) throw new Error(`sentiment common date ${commonAsOf ?? 'missing'} is outside the recent market calendar`);
const lagTradingDays = marketDates.length - 1 - position;
if (lagTradingDays > 1) throw new Error(`sentiment snapshot is stale: ${commonAsOf} trails market ${marketDates.at(-1)} by ${lagTradingDays} trading days`);
if (SENTIMENT_SEED_ROWS.length < 240) throw new Error(`sentiment history is incomplete: ${SENTIMENT_SEED_ROWS.length} rows`);
console.log(`sentiment freshness passed: common ${commonAsOf}; market ${marketDates.at(-1)}; lag ${lagTradingDays} trading day(s)`);
