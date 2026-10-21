import { writeFile } from 'node:fs/promises';
import { setDefaultResultOrder } from 'node:dns';
import { refreshEtfActivity } from '../server/etf-activity.mjs';
import { ETF_ACTIVITY_SEED } from '../server/etf-activity-seed.mjs';

setDefaultResultOrder('ipv4first');
const snapshot = await refreshEtfActivity(ETF_ACTIVITY_SEED);
if (snapshot.histories.some((item) => item.bars.length < 20)) throw new Error('ETF snapshot incomplete; keeping committed snapshot');
await writeFile(new URL('../server/etf-activity-seed.mjs', import.meta.url), `// Generated from public Eastmoney daily turnover, in yuan.\nexport const ETF_ACTIVITY_SEED = ${JSON.stringify(snapshot)};\n`);
console.log(JSON.stringify(snapshot.histories.map((item) => ({ code: item.code, asOf: item.bars.at(-1)?.time, cached: item.cached }))));
