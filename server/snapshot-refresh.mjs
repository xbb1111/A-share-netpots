const lifetime = 2 * 60 * 60_000;
const terminal = (status) => status === 'completed' || status === 'failed';
const headers = { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' };

export class SnapshotRefresh {
  constructor(state) {
    this.state = state;
  }

  async fetch(request) {
    if (new URL(request.url).pathname.endsWith('/report')) return this.report(request);
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
    const saved = job.status ?? (job.run?.terminal ? job.run.status : 'queued');
    const status = now - job.createdAt >= lifetime && !terminal(saved) ? 'expired' : saved;
    return Response.json({ id: job.id, createdAt: job.createdAt, retryAt: job.createdAt + lifetime, status }, { headers });
  }

  async report(request) {
    // The Worker entry point validates the GitHub job identity before forwarding.
    const { id, status, runId } = await request.json();
    if (!['running', 'completed', 'failed'].includes(status) || !/^\d+$/.test(runId)) return new Response(null, { status: 400 });
    const matched = await this.state.storage.transaction(async (tx) => {
      const job = await tx.get('job');
      if (!job || job.id !== id || (job.runId && job.runId !== runId)) return false;
      if (!terminal(job.status)) await tx.put('job', { ...job, status, runId });
      return true;
    });
    return new Response(null, { status: matched ? 204 : 409 });
  }
}
