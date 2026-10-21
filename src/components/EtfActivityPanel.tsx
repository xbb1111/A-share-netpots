import { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { buildEtfActivity, fetchEtfActivity, mergeEtfHistories, readEtfCache, saveEtfCache } from '../data/etfActivity';

const money = (value: number | null) => value === null ? '—' : `${value.toFixed(1)} 亿`;
const multiple = (value: number | null) => value === null ? '—' : `${value.toFixed(2)}x`;
const tone = (value: number | null) => value === null || value === 1 ? '' : value > 1 ? 'positive' : 'negative';

export function EtfActivityPanel() {
  const [histories, setHistories] = useState(readEtfCache);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [checkedAt, setCheckedAt] = useState('');
  const inFlight = useRef(false);
  const lastAttempt = useRef(0);
  const data = useMemo(() => buildEtfActivity(histories, selectedDate), [histories, selectedDate]);
  const cachedCount = histories.filter((item) => item.cached).length;

  async function load(manual = false) {
    if (inFlight.current || (!manual && Date.now() - lastAttempt.current < 60000)) return;
    inFlight.current = true;
    lastAttempt.current = Date.now();
    setLoading(true);
    setError('');
    try {
      const next = await fetchEtfActivity(manual);
      setHistories((previous) => {
        const merged = mergeEtfHistories(previous, next);
        saveEtfCache(merged);
        return merged;
      });
      setCheckedAt(new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }));
      if (next.every((item) => !item.bars.length)) setError('ETF 成交额暂不可用，请稍后重试。');
    } catch { setError('本次刷新未成功，已保留上次数据。可点击“刷新行情”重试。'); }
    finally { setLoading(false); inFlight.current = false; }
  }
  useEffect(() => {
    void load();
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    const timer = window.setInterval(() => {
      const now = new Date();
      const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(now);
      const hour = Number(parts.find((part) => part.type === 'hour')?.value);
      const weekday = parts.find((part) => part.type === 'weekday')?.value;
      if (document.visibilityState === 'visible' && weekday !== 'Sat' && weekday !== 'Sun' && hour >= 9 && hour <= 15) void load();
    }, 60000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  return <section className="capital-tool panel etf-activity" aria-label="ETF 资金观察">
    <div className="capital-tool__heading">
      <SectionHeader icon={BarChart3} eyebrow="ETF Activity" title="ETF 资金观察" />
      <button type="button" className="capital-refresh" disabled={loading} onClick={() => void load(true)}><RefreshCw size={15} className={loading ? 'spin' : undefined} />{loading ? '正在更新' : '刷新行情'}</button>
    </div>
    <p className="etf-activity__intro">跟踪 10 只核心宽基 ETF 的成交活跃度，观察资金关注方向。</p>
    <div className="capital-controls">
      <label>数据日期 <select aria-label="ETF 数据日期" value={data.date ?? ''} disabled={loading || !data.dates.length} onChange={(event) => setSelectedDate(event.target.value)}>{data.dates.map((date) => <option key={date}>{date}</option>)}</select></label>
      <span>成交额覆盖 {data.total.coverage}/10 · {checkedAt ? `北京时间 ${checkedAt} 检查` : '正在检查最新数据'} · 交易时段每分钟自动检查</span>
    </div>
    {error ? <div className="capital-error" role="alert">{error}</div> : null}
    {cachedCount > 0 ? <p className="etf-activity__cache-note" role="status">{cachedCount} 只 ETF 正在使用上次有效快照；请以表内数据日期为准，刷新成功后自动替换。</p> : null}
    {loading && !histories.length ? <div className="capital-loading">正在读取 ETF 日线成交数据…</div> : null}
    {histories.length ? <div className="capital-table-wrap"><table className="capital-table etf-activity__table">
      <thead><tr><th>ETF（按当日成交额排序）</th><th>当日成交</th><th>vs 前15日均值</th><th>vs 上周五 {data.friday ?? ''}</th></tr></thead>
      <tbody>{data.rows.map((row, index) => <tr key={row.code} className={index === 0 && row.amount !== null ? 'etf-activity__leader' : undefined}>
        <td><strong>{row.name}</strong><span>{row.code}{row.error ? ` · ${row.error}` : row.amount === null ? ' · 当日成交额缺失' : ''}</span>{row.cached ? <small>快照确认于 {row.updatedAt ? new Date(row.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '—'}</small> : null}</td>
        <td>{money(row.amount)}</td><td className={tone(row.averageRatio)}>{multiple(row.averageRatio)}</td><td className={tone(row.fridayRatio)}>{multiple(row.fridayRatio)}</td>
      </tr>)}</tbody>
      <tfoot>{[{ label: '10只合计', summary: data.total }, { label: '四只沪深300合计', summary: data.csi300 }].map(({ label, summary }) => <tr key={label}>
        <td><strong>{label}</strong><span>成交额覆盖 {summary.coverage}/{summary.expected}</span></td><td>{money(summary.amount)}</td><td className={tone(summary.averageRatio)}>{multiple(summary.averageRatio)}</td><td className={tone(summary.fridayRatio)}>{multiple(summary.fridayRatio)}{summary.fridayRatio !== null ? <small>较上周五{summary.fridayRatio >= 1 ? '增' : '缩'} {Math.abs((summary.fridayRatio - 1) * 100).toFixed(1)}%</small> : null}</td>
      </tr>)}</tfoot>
    </table></div> : null}
    <p className="capital-disclaimer">数据源：东方财富日线成交额，由服务端校验并汇总；接口故障时使用上次有效快照，保留原数据日期。成交额反映交易活跃度，不代表资金净流入。15 日均值取所选日期之前 15 个交易日，不含当日；上周五按上一自然周计算，遇休市不补值。盘中为累计成交，与完整交易日比较仅供观察；缺失数据不参与完整合计。</p>
  </section>;
}
