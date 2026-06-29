import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  CalendarDays,
  CandlestickChart,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Factory,
  LineChart,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MetricCard } from './components/MetricCard';
import { SectionHeader } from './components/SectionHeader';
import { getDashboardData, getTrendIconName } from './data/marketService';
import type { AlertSignal, TrendDirection } from './data/types';

const data = getDashboardData();

const heatTrend = [
  { time: '09:30', value: 48 },
  { time: '10:00', value: 57 },
  { time: '10:30', value: 61 },
  { time: '11:00', value: 66 },
  { time: '13:00', value: 62 },
  { time: '14:00', value: 69 },
  { time: '14:45', value: 73 },
];

function formatChange(value: number) {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

function TrendBadge({ trend }: { trend: TrendDirection }) {
  const Icon = trend === 'down' ? ArrowDownRight : trend === 'up' ? ArrowUpRight : CircleDot;

  return (
    <span className={`trend-badge trend-badge--${trend}`}>
      <Icon size={14} aria-hidden="true" />
      {getTrendIconName(trend)}
    </span>
  );
}

function getAlertIcon(type: AlertSignal['type']) {
  if (type === 'risk') {
    return ShieldCheck;
  }

  if (type === 'volume') {
    return CandlestickChart;
  }

  if (type === 'price') {
    return Target;
  }

  return Sparkles;
}

export default function App() {
  return (
    <main className="terminal-shell">
      <aside className="sidebar" aria-label="投研导航">
        <div className="brand">
          <div className="brand__mark">A</div>
          <div>
            <strong>Alpha Desk</strong>
            <span>A 股投研工作台</span>
          </div>
        </div>
        <nav className="nav-list">
          <a className="nav-list__item nav-list__item--active" href="#overview">
            <LineChart size={18} aria-hidden="true" />
            总览
          </a>
          <a className="nav-list__item" href="#industries">
            <Factory size={18} aria-hidden="true" />
            行业
          </a>
          <a className="nav-list__item" href="#watchlist">
            <ClipboardList size={18} aria-hidden="true" />
            股票池
          </a>
          <a className="nav-list__item" href="#alerts">
            <Bell size={18} aria-hidden="true" />
            预警
          </a>
        </nav>
        <div className="sidebar__note">
          <span>当前模式</span>
          <strong>模拟数据</strong>
          <p>数据层已独立封装，后续可替换为真实行情与预警服务。</p>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar" id="overview">
          <div>
            <span className="eyebrow">Personal Research Terminal</span>
            <h1>A 股行业分析与选股预警</h1>
          </div>
          <div className="search-box">
            <Search size={17} aria-hidden="true" />
            <span>搜索行业、股票、策略标签</span>
          </div>
        </header>

        <section className="overview-grid">
          {data.overview.map((metric) => (
            <MetricCard key={metric.label} metric={metric} />
          ))}
        </section>

        <section className="content-grid">
          <div className="panel panel--wide" id="industries">
            <SectionHeader icon={Factory} eyebrow="Sector Radar" title="行业强弱与资金热度" />
            <div className="industry-layout">
              <div className="chart-box">
                <ResponsiveContainer width="100%" height={268}>
                  <BarChart data={data.industries} layout="vertical" margin={{ left: 8, right: 16, top: 10, bottom: 10 }}>
                    <CartesianGrid stroke="#23313d" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} hide />
                    <YAxis dataKey="name" type="category" width={96} tick={{ fill: '#93a4b3', fontSize: 12 }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(218, 181, 111, 0.08)' }} contentStyle={{ background: '#101820', border: '1px solid #273542', borderRadius: 6, color: '#dbe5ee' }} />
                    <Bar dataKey="heat" radius={[0, 6, 6, 0]}>
                      {data.industries.map((item) => (
                        <Cell key={item.name} fill={item.trend === 'down' ? '#b85b62' : item.trend === 'up' ? '#38b894' : '#d6aa5c'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="industry-table">
                {data.industries.slice(0, 6).map((industry) => (
                  <article key={industry.name} className="industry-row">
                    <div>
                      <strong>{industry.name}</strong>
                      <span>{industry.momentum}</span>
                    </div>
                    <div>
                      <span className={industry.capitalFlow >= 0 ? 'positive' : 'negative'}>
                        {industry.capitalFlow > 0 ? '+' : ''}
                        {industry.capitalFlow} 亿
                      </span>
                      <small>{industry.valuation}</small>
                    </div>
                    <TrendBadge trend={industry.trend} />
                  </article>
                ))}
              </div>
            </div>
          </div>

          <aside className="panel">
            <SectionHeader icon={LineChart} eyebrow="Market Pulse" title="盘中温度曲线" />
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={heatTrend} margin={{ left: 0, right: 0, top: 12, bottom: 0 }}>
                <defs>
                  <linearGradient id="heatGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#d6aa5c" stopOpacity={0.42} />
                    <stop offset="100%" stopColor="#d6aa5c" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#22303a" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: '#7c8a96', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis hide domain={[30, 90]} />
                <Tooltip contentStyle={{ background: '#101820', border: '1px solid #273542', borderRadius: 6, color: '#dbe5ee' }} />
                <Area type="monotone" dataKey="value" stroke="#d6aa5c" strokeWidth={2} fill="url(#heatGradient)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="pulse-summary">
              <span>资金偏好</span>
              <strong>成长 + 制造</strong>
              <p>指数波动不大，但强势行业内部轮动正在加快。</p>
            </div>
          </aside>
        </section>

        <section className="content-grid content-grid--lower">
          <div className="panel panel--wide" id="watchlist">
            <SectionHeader icon={ClipboardList} eyebrow="Stock Pool" title="候选股票池" />
            <div className="stock-table" role="table" aria-label="候选股票池">
              <div className="stock-table__head" role="row">
                <span>股票</span>
                <span>行业</span>
                <span>评分</span>
                <span>涨跌幅</span>
                <span>标签</span>
                <span>逻辑</span>
              </div>
              {data.watchlist.map((stock) => (
                <article className="stock-row" key={stock.code} role="row">
                  <div>
                    <strong>{stock.name}</strong>
                    <span>{stock.code}</span>
                  </div>
                  <span>{stock.industry}</span>
                  <div className="score">
                    <b>{stock.score}</b>
                    <i style={{ width: `${stock.score}%` }} />
                  </div>
                  <span className={stock.change >= 0 ? 'positive' : 'negative'}>{formatChange(stock.change)}</span>
                  <div className="tag-list">
                    {stock.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                  <p>{stock.thesis}</p>
                </article>
              ))}
            </div>
          </div>

          <aside className="side-stack">
            <section className="panel" id="alerts">
              <SectionHeader icon={AlertTriangle} eyebrow="Alert Queue" title="预警中心" />
              <div className="alert-list">
                {data.alerts.map((alert) => {
                  const Icon = getAlertIcon(alert.type);

                  return (
                    <article className={`alert-card alert-card--${alert.level}`} key={`${alert.target}-${alert.time}`}>
                      <div className="alert-card__icon">
                        <Icon size={17} aria-hidden="true" />
                      </div>
                      <div>
                        <div className="alert-card__top">
                          <strong>{alert.title}</strong>
                          <span>{alert.time}</span>
                        </div>
                        <b>{alert.target}</b>
                        <p>{alert.message}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>

            <section className="panel">
              <SectionHeader icon={CalendarDays} eyebrow="Calendar" title="市场日历" />
              <div className="calendar-list">
                {data.marketCalendar.map((item) => (
                  <article key={`${item.date}-${item.event}`}>
                    <span>{item.date}</span>
                    <div>
                      <strong>{item.event}</strong>
                      <p>{item.impact}</p>
                    </div>
                    <ChevronRight size={16} aria-hidden="true" />
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </section>

        <section className="bottom-grid">
          <div className="panel">
            <SectionHeader icon={Sparkles} eyebrow="Theme Watch" title="关注主题" />
            <div className="theme-list">
              {data.themes.map((theme) => (
                <article key={theme.name}>
                  <div>
                    <strong>{theme.name}</strong>
                    <span>{theme.strength}</span>
                  </div>
                  <i style={{ width: `${theme.strength}%` }} />
                  <p>{theme.notes}</p>
                </article>
              ))}
            </div>
          </div>
          <div className="panel">
            <SectionHeader icon={ClipboardList} eyebrow="Memo" title="策略备忘" />
            <div className="memo-grid">
              {data.memos.map((memo) => (
                <article key={memo.title}>
                  <strong>{memo.title}</strong>
                  <p>{memo.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
