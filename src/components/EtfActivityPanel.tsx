import { useEffect, useMemo, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { buildEtfActivity, fetchEtfActivity, type ActivityHistory } from '../data/etfActivity';

const money = (value: number | null) => value === null ? '—' : `${value.toFixed(1)} 亿`;
const multiple = (value: number | null) => value === null ? '—' : `${value.toFixed(2)}x`;
const tone = (value: number | null) => value === null || value === 1 ? '' : value > 1 ? 'positive' : 'negative';

export function EtfActivityPanel() {
  const [histories, setHistories] = useState<ActivityHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [checkedAt, setCheckedAt] = useState('');
  const data = useMemo(() => buildEtfActivity(histories, selectedDate), [histories, selectedDate]);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const next = await fetchEtfActivity();
      setHistories(next);
      setCheckedAt(new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }));
      if (next.every((item) => item.error)) setError('ETF 行情暂时不可用，请稍后重试。');
    } catch { setError('ETF 行情加载失败，请重试。'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  return <section className="capital-tool panel etf-activity" aria-label="ETF 资金观察">
    <div className="capital-tool__heading">
      <SectionHeader icon={BarChart3} eyebrow="ETF Activity" title="ETF 资金观察" />
      <button type="button" className="capital-refresh" disabled={loading} onClick={() => void load()}><RefreshCw size={15} className={loading ? 'spin' : undefined} />{loading ? '加载中' : '刷新行情'}</button>
    </div>
    <p className="etf-activity__intro">跟踪 10 只核心宽基 ETF 的成交活跃度，观察资金关注方向。</p>
    <div className="capital-controls">
      <label>数据日期 <select aria-label="ETF 数据日期" value={data.date ?? ''} disabled={loading || !data.dates.length} onChange={(event) => setSelectedDate(event.target.value)}>{data.dates.map((date) => <option key={date}>{date}</option>)}</select></label>
      <span>成交额覆盖 {data.total.coverage}/10 · 北京时间{checkedAt ? ` ${checkedAt} 检查` : '加载中'}</span>
    </div>
    {error ? <div className="capital-error" role="alert">{error}</div> : null}
    {loading && !histories.length ? <div className="capital-loading">正在读取 ETF 日线成交数据…</div> : null}
    {histories.length ? <div className="capital-table-wrap"><table className="capital-table etf-activity__table">
      <thead><tr><th>ETF（按当日成交额排序）</th><th>当日成交</th><th>vs 前15日均值</th><th>vs 上周五 {data.friday ?? ''}</th></tr></thead>
      <tbody>{data.rows.map((row, index) => <tr key={row.code} className={index === 0 && row.amount !== null ? 'etf-activity__leader' : undefined}>
        <td><strong>{row.name}</strong><span>{row.code}{row.error ? ` · ${row.error}` : row.amount === null ? ' · 当日成交额缺失' : ''}</span></td>
        <td>{money(row.amount)}</td><td className={tone(row.averageRatio)}>{multiple(row.averageRatio)}</td><td className={tone(row.fridayRatio)}>{multiple(row.fridayRatio)}</td>
      </tr>)}</tbody>
      <tfoot>{[{ label: '10只合计', summary: data.total }, { label: '四只沪深300合计', summary: data.csi300 }].map(({ label, summary }) => <tr key={label}>
        <td><strong>{label}</strong><span>成交额覆盖 {summary.coverage}/{summary.expected}</span></td><td>{money(summary.amount)}</td><td className={tone(summary.averageRatio)}>{multiple(summary.averageRatio)}</td><td className={tone(summary.fridayRatio)}>{multiple(summary.fridayRatio)}{summary.fridayRatio !== null ? <small>较上周五{summary.fridayRatio >= 1 ? '增' : '缩'} {Math.abs((summary.fridayRatio - 1) * 100).toFixed(1)}%</small> : null}</td>
      </tr>)}</tfoot>
    </table></div> : null}
    <p className="capital-disclaimer">口径：成交额反映交易活跃度，不代表资金净流入。15 日均值取所选日期之前 15 个交易日，不含当日；上周五按所选日期的上一自然周计算，遇休市不补值。盘中数据为累计成交，与完整交易日比较仅供观察。缺失成交额、历史不足或基准为零显示“—”，合计仅在数据齐全时计算。数据来自现有公开行情接口；备用行情未提供成交额时显示缺失。</p>
  </section>;
}
