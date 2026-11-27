import { handleFinancialReportRequest } from './financial-report-api.mjs';
import { createRemoteJWKSet, jwtVerify } from 'jose';
export { SnapshotRefresh } from './snapshot-refresh.mjs';

const issuer = 'https://token.actions.githubusercontent.com';
const keys = createRemoteJWKSet(new URL(issuer + '/.well-known/jwks'));
const reportUrl = 'https://a-share-financial-report-api.2561340168.workers.dev/api/snapshot-refresh/report';
const workflowRef = 'xbb1111/A-share-netpots/.github/workflows/financial-report-worker.yml@refs/heads/main';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/snapshot-refresh/report') {
      if (request.method !== 'POST') return new Response(null, { status: 405 });
      const token = /^Bearer (\S+)$/.exec(request.headers.get('Authorization') ?? '')?.[1];
      if (!token) return new Response(null, { status: 401 });
      let claims;
      try {
        ({ payload: claims } = await jwtVerify(token, keys, { issuer, audience: reportUrl, algorithms: ['RS256'], requiredClaims: ['exp', 'run_id'] }));
      } catch {
        return new Response(null, { status: 401 });
      }
      if (claims.workflow_ref !== workflowRef || claims.event_name !== 'workflow_dispatch' || claims.ref !== 'refs/heads/main') return new Response(null, { status: 403 });
      const { id, status } = await request.json();
      return env.SNAPSHOT_REFRESH.get(env.SNAPSHOT_REFRESH.idFromName('market')).fetch(reportUrl, {
        method: 'POST', body: JSON.stringify({ id, status, runId: String(claims.run_id) }),
      });
    }
    if (path === '/api/snapshot-refresh' && request.method !== 'OPTIONS') {
      return env.SNAPSHOT_REFRESH.get(env.SNAPSHOT_REFRESH.idFromName('market')).fetch(request);
    }
    return handleFinancialReportRequest(request);
  },
};
