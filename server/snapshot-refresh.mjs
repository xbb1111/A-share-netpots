const lifetime = 2 * 60 * 60_000;
const runsUrl = 'https://api.github.com/repos/xbb1111/A-share-netpots/actions/workflows/financial-report-worker.yml/runs?event=workflow_dispatch&branch=main&per_page=30';
const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

export class SnapshotRefresh {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    const write = request.method === 'POST';
    if (!write && request.method !== 'GET') return new Response(null, { status: 405, headers });
    // All panels and visitors share one durable request and one collection budget.
    const now = Date.now();
    const job = await this.state.storage.transaction(async (tx) => {
      const previous = await tx.get('job');
      if (!write || (previous && now - previous.createdAt < lifetime)) return previous;
      const next = { id: crypto.randomUUID(), createdAt: now };
      await tx.put('job', next);
      return next;
    });
    if (!job) return Response.json({ status: 'idle' }, { headers });
    const expired = now - job.createdAt >= lifetime;
    let status = 'queued';
    let runUrl = null;
    if (job.run && (job.run.terminal || now - job.run.checkedAt < 90_000)) {
      ({ status, runUrl } = job.run);
    } else if (!expired) {
      try {
        const response = await fetch(runsUrl, { headers: { 'User-Agent': 'a-share-snapshot-refresh', Accept: 'application/vnd.github+json' }, signal: AbortSignal.timeout(6000) });
        if (!response.ok) throw new Error('Run lookup unavailable');
        const run = (await response.json()).workflow_runs.find((item) => item.display_title === 'Website refresh ' + job.id);
        if (run) {
          status = run.status === 'completed' ? (run.conclusion === 'success' ? 'completed' : 'failed') : 'running';
          runUrl = 'https://github.com/xbb1111/A-share-netpots/actions/runs/' + run.id;
        }
      } catch {
        status = 'unknown';
      }
      await this.state.storage.transaction(async (tx) => {
        const current = await tx.get('job');
        if (current?.id === job.id && !current.run?.terminal) {
          await tx.put('job', { ...job, run: { status, runUrl, checkedAt: now, terminal: ['completed', 'failed'].includes(status) } });
        }
      });
    }
    if (expired && !['completed', 'failed'].includes(status)) status = 'expired';
    return Response.json({ id: job.id, createdAt: job.createdAt, retryAt: job.createdAt + lifetime, status, runUrl }, { headers });
  }
}
