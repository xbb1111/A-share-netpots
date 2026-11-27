import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { buildFinancialApiUrl } from '../data/financialReportService';

type Ticket = {
  status: 'idle' | 'queued' | 'running' | 'completed' | 'failed' | 'unknown' | 'expired';
  id?: string;
  createdAt?: number;
  retryAt?: number;
};

async function getTicket(method: 'GET' | 'POST', signal?: AbortSignal): Promise<Ticket> {
  const response = await fetch(buildFinancialApiUrl('/api/snapshot-refresh'), { method, cache: 'no-store', signal });
  if (!response.ok) throw new Error('更新服务暂时无法连接，请稍后重试。');
  const ticket = await response.json();
  if (!['idle', 'queued', 'running', 'completed', 'failed', 'unknown', 'expired'].includes(ticket.status)) throw new Error('更新服务返回了无效状态。');
  return ticket;
}

export function SnapshotRefreshControl({ className, onReload, dataDate, updatedAt }: {
  className: string;
  onReload: () => Promise<void>;
  dataDate?: string | null;
  updatedAt?: string | null;
}) {
  const [ticket, setTicket] = useState<Ticket>({ status: 'idle' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const baseline = useRef<string | null>(null);
  const reload = useRef(onReload);
  const lastReload = useRef<string | undefined>(undefined);
  const revision = useRef(0);
  const alive = useRef(true);
  reload.current = onReload;

  const apply = useCallback((next: Ticket) => {
    setTicket(next);
    setError('');
    if (next.id && next.id !== lastReload.current && ['completed', 'failed'].includes(next.status)) {
      lastReload.current = next.id;
      void reload.current();
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function poll() {
      const current = revision.current;
      try {
        const next = await getTicket('GET', controller.signal);
        if (!controller.signal.aborted && current === revision.current) apply(next);
      } catch {
        if (!controller.signal.aborted && current === revision.current) setError('暂时无法读取更新进度，可稍后再查看。');
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 60_000);
      }
    }
    void poll();
    return () => { alive.current = false; clearTimeout(timer); controller.abort(); };
  }, [apply]);

  async function requestUpdate() {
    revision.current += 1;
    baseline.current = dataDate ?? null;
    setSending(true);
    try {
      const next = await getTicket('POST');
      if (alive.current) apply(next);
    } catch {
      if (alive.current) setError('更新请求未确认，请重试。重复提交会合并。');
    } finally {
      if (alive.current) setSending(false);
    }
  }

  const active = ['queued', 'running', 'unknown'].includes(ticket.status);
  const cooling = Boolean(ticket.retryAt && ticket.retryAt > Date.now());
  const messages = {
    idle: '', queued: '已排队，后台约每 15 分钟检查一次。离开页面后任务会继续。',
    running: '正在采集并计算，完成后自动读取结果。',
    unknown: '已收到更新请求，正在等待任务状态。',
    completed: updatedAt && ticket.createdAt && Date.parse(updatedAt) < ticket.createdAt
      ? '本轮未取得通过校验的新快照，仍显示 ' + (dataDate ?? '—') + ' 的数据。'
      : baseline.current && dataDate && dataDate > baseline.current
      ? '数据日已从 ' + baseline.current + ' 更新至 ' + dataDate + '。'
      : '本轮检查已完成，当前可用数据日为 ' + (dataDate ?? '—') + '。',
    failed: '本轮更新未全部完成，当前可用数据日为 ' + (dataDate ?? '—') + '。',
    expired: '上次任务的确认已超时，可以重新发起更新。',
  };
  const label = sending ? '正在提交' : active ? '更新处理中' : cooling ? '本轮已结束' : '更新数据';
  const text = error || messages[ticket.status];
  return <div className="snapshot-refresh-control">
    <button type="button" className={className} disabled={sending || active || cooling} onClick={() => void requestUpdate()}>
      <RefreshCw size={15} aria-hidden="true" className={sending || ticket.status === 'running' ? 'spin' : undefined} />{label}
    </button>
    {text && <small role="status">{text}{cooling && !active && !error ? ' 下次可提交 ' + new Date(ticket.retryAt!).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Shanghai' }) + '（北京时间）。' : ''}</small>}
    {updatedAt && <small>快照生成于 {new Date(updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}（北京时间）</small>}
  </div>;
}
