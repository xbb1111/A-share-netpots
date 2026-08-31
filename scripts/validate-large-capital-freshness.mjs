import { LARGE_CAPITAL_SEED } from '../server/large-capital-seed.mjs';

const maxLagDays = Number(process.env.LARGE_CAPITAL_MAX_LAG_DAYS ?? 7);
const asOf = LARGE_CAPITAL_SEED.asOf ? new Date(`${LARGE_CAPITAL_SEED.asOf}T16:00:00+08:00`) : null;
const lagDays = asOf ? (Date.now() - asOf.getTime()) / 86400000 : Infinity;
const etfCount = LARGE_CAPITAL_SEED.nationalTeam?.etfs?.length ?? 0;
const productCount = LARGE_CAPITAL_SEED.institutions?.products?.filter((item) => item.asOf).length ?? 0;
const benchmarkCount = LARGE_CAPITAL_SEED.benchmarks?.length ?? 0;
const latestFlowCoverage = LARGE_CAPITAL_SEED.nationalTeam?.etfs?.filter((item) => item.asOf === LARGE_CAPITAL_SEED.nationalTeam.asOf && Number.isFinite(item.nav) && item.nav > 0 && Number.isFinite(item.shares) && item.shares > 0 && Number.isFinite(item.netFlowYi)).length ?? 0;

if (!asOf || lagDays > maxLagDays || etfCount < 8 || latestFlowCoverage < 8 || productCount < 3 || benchmarkCount < 6) {
  throw new Error(`Large-capital snapshot failed validation: asOf=${LARGE_CAPITAL_SEED.asOf}, lagDays=${lagDays.toFixed(1)}, etfs=${etfCount}, latestFlowCoverage=${latestFlowCoverage}, products=${productCount}, benchmarks=${benchmarkCount}`);
}

console.log(`Large-capital snapshot valid: ${LARGE_CAPITAL_SEED.asOf}, ${latestFlowCoverage}/${etfCount} current ETF flows, ${productCount} products, ${benchmarkCount} benchmarks`);
