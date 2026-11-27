import { handleFinancialReportRequest } from '../server/financial-report-api.mjs';

const origin = 'https://a-share-financial-report-api.2561340168.workers.dev';
for (const [path, dates] of [
  ['/api/market-sentiment', (snapshot) => [snapshot.commonAsOf, snapshot.themeAsOf]],
  ['/api/large-capital-flows', (snapshot) => [snapshot.asOf, snapshot.nationalTeam.asOf, snapshot.institutions.asOf]],
]) {
  const url = new URL(path, origin);
  const published = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30_000) });
  if (!published.ok) throw new Error('Unable to check published snapshot at ' + path);
  const current = dates(await published.json());
  const candidate = dates(await (await handleFinancialReportRequest(new Request(url))).json());
  if (current.some((date, index) => date && (!candidate[index] || candidate[index] < date))) {
    throw new Error(path + ' would move a published data date backwards: ' + current + ' -> ' + candidate);
  }
  console.log(path, current, '->', candidate);
}
