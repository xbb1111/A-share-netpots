import { handleFinancialReportRequest } from './financial-report-api.mjs';
export { SnapshotRefresh } from './snapshot-refresh.mjs';

export default {
  fetch(request, env) {
    if (new URL(request.url).pathname === '/api/snapshot-refresh' && request.method !== 'OPTIONS') {
      return env.SNAPSHOT_REFRESH.get(env.SNAPSHOT_REFRESH.idFromName('market')).fetch(request);
    }
    return handleFinancialReportRequest(request);
  },
};
