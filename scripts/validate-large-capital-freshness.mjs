import { LARGE_CAPITAL_SEED } from '../server/large-capital-seed.mjs';

const maxLagDays = Number(process.env.LARGE_CAPITAL_MAX_LAG_DAYS ?? 7);
const asOf = LARGE_CAPITAL_SEED.asOf ? new Date(`${LARGE_CAPITAL_SEED.asOf}T16:00:00+08:00`) : null;
const lagDays = asOf ? (Date.now() - asOf.getTime()) / 86400000 : Infinity;
const etfCount = LARGE_CAPITAL_SEED.nationalTeam?.etfs?.length ?? 0;
const productCount = LARGE_CAPITAL_SEED.institutions?.products?.filter((item) => item.asOf).length ?? 0;
const benchmarkCount = LARGE_CAPITAL_SEED.benchmarks?.length ?? 0;

if (!asOf || lagDays > maxLagDays || etfCount < 8 || productCount < 3 || benchmarkCount < 6) {
  throw new Error(`Large-capital snapshot failed validation: asOf=${LARGE_CAPITAL_SEED.asOf}, lagDays=${lagDays.toFixed(1)}, etfs=${etfCount}, products=${productCount}, benchmarks=${benchmarkCount}`);
}

console.log(`Large-capital snapshot valid: ${LARGE_CAPITAL_SEED.asOf}, ${etfCount} ETFs, ${productCount} products, ${benchmarkCount} benchmarks`);
