import { useEffect, useMemo, useState } from 'react';
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
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Wrench,
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
import type { AlertSignal, DashboardData, TrendDirection } from './data/types';

type PageKey = 'overview' | 'industries' | 'watchlist' | 'alerts' | 'toolbox';

type ToolboxItem = {
  id: string;
  name: string;
  url: string;
};

const NAV_ITEMS: Array<{ key: PageKey; label: string; icon: typeof LineChart }> = [
  { key: 'overview', label: '总览', icon: LineChart },
  { key: 'industries', label: '行业', icon: Factory },
  { key: 'watchlist', label: '股票池', icon: ClipboardList },
  { key: 'alerts', label: '预警', icon: Bell },
  { key: 'toolbox', label: '工具箱', icon: Wrench },
];

const DEFAULT_TOOLS: ToolboxItem[] = [
  { id: 'position', name: '仓位测算', url: 'https://www.jisilu.cn/data/position/' },
  { id: 'calendar', name: '交易日历', url: 'https://www.sse.com.cn/disclosure/dealinstruc/closed/' },
  { id: 'announcements', name: '公告检索', url: 'https://www.cninfo.com.cn/new/index' },
];

function getInitialPage(): PageKey {
  const hash = window.location.hash.replace('#', '');
  return NAV_ITEMS.some((item) => item.key === hash) ? (hash as PageKey) : 'overview';
}

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

function OverviewPage({ data }: { data: DashboardData }) {
  return (
    <>
      <section className="overview-grid">
        {data.overview.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </section>

      <section className="content-grid">
        <div className="panel panel--wide">
          <SectionHeader icon={Factory} eyebrow="Sector Radar" title="行业资金前排" />
          <div className="industry-table industry-table--wide">
            {data.industries.slice(0, 8).map((industry) => (
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

        <aside className="panel">
          <SectionHeader icon={LineChart} eyebrow="Market Pulse" title="盘中温度曲线" />
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.heatTrend} margin={{ left: 0, right: 0, top: 12, bottom: 0 }}>
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
        </aside>
      </section>
    </>
  );
}

function IndustriesPage({ data }: { data: DashboardData }) {
  return (
    <section className="panel" id="industries">
      <SectionHeader icon={Factory} eyebrow="Sector Radar" title="行业强弱与资金热度" />
      <div className="industry-layout industry-layout--page">
        <div className="chart-box">
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={data.industries} layout="vertical" margin={{ left: 8, right: 16, top: 10, bottom: 10 }}>
              <CartesianGrid stroke="#23313d" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} hide />
              <YAxis dataKey="name" type="category" width={110} tick={{ fill: '#93a4b3', fontSize: 12 }} axisLine={false} tickLine={false} />
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
          {data.industries.map((industry) => (
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
    </section>
  );
}

function WatchlistPage({ data }: { data: DashboardData }) {
  return (
    <section className="panel" id="watchlist">
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
    </section>
  );
}

function AlertsPage({ data }: { data: DashboardData }) {
  return (
    <section className="content-grid content-grid--lower">
      <div className="panel" id="alerts">
        <SectionHeader icon={AlertTriangle} eyebrow="Alert Queue" title="预警中心" />
        <div className="alert-list alert-list--page">
          {data.alerts.map((alert) => {
            const Icon = getAlertIcon(alert.type);

            return (
              <article className={`alert-card alert-card--${alert.level}`} key={`${alert.target}-${alert.time}-${alert.title}`}>
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
      </div>

      <aside className="side-stack">
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

        <section className="panel">
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
        </section>
      </aside>
    </section>
  );
}

function ToolboxPage() {
  const [tools, setTools] = useState<ToolboxItem[]>(() => {
    const saved = window.localStorage.getItem('alpha-desk-tools');
    return saved ? (JSON.parse(saved) as ToolboxItem[]) : DEFAULT_TOOLS;
  });
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');

  useEffect(() => {
    window.localStorage.setItem('alpha-desk-tools', JSON.stringify(tools));
  }, [tools]);

  function addTool() {
    const trimmedName = name.trim();
    const trimmedUrl = url.trim();

    if (!trimmedName || !trimmedUrl) {
      return;
    }

    const normalizedUrl = /^https?:\/\//i.test(trimmedUrl) ? trimmedUrl : `https://${trimmedUrl}`;
    setTools((current) => [...current, { id: crypto.randomUUID(), name: trimmedName, url: normalizedUrl }]);
    setName('');
    setUrl('');
  }

  function removeTool(id: string) {
    setTools((current) => current.filter((tool) => tool.id !== id));
  }

  return (
    <section className="toolbox-page">
      <div className="panel toolbox-editor">
        <SectionHeader icon={Wrench} eyebrow="Toolbox" title="工具箱" />
        <div className="tool-form">
          <label>
            <span>名称</span>
            <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：估值计算器" />
          </label>
          <label>
            <span>链接</span>
            <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." />
          </label>
          <button type="button" onClick={addTool}>
            <Plus size={16} aria-hidden="true" />
            添加
          </button>
        </div>
      </div>

      <div className="tool-grid">
        {tools.map((tool) => (
          <article className="tool-card" key={tool.id}>
            <a href={tool.url} target="_blank" rel="noreferrer">
              <strong>{tool.name}</strong>
              <span>{tool.url.replace(/^https?:\/\//, '')}</span>
            </a>
            <button type="button" onClick={() => removeTool(tool.id)} aria-label={`删除 ${tool.name}`}>
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

function renderPage(page: PageKey, data: DashboardData) {
  if (page === 'industries') {
    return <IndustriesPage data={data} />;
  }

  if (page === 'watchlist') {
    return <WatchlistPage data={data} />;
  }

  if (page === 'alerts') {
    return <AlertsPage data={data} />;
  }

  if (page === 'toolbox') {
    return <ToolboxPage />;
  }

  return <OverviewPage data={data} />;
}

export default function App() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState<PageKey>(getInitialPage);
  const pageTitle = useMemo(() => NAV_ITEMS.find((item) => item.key === currentPage)?.label ?? '总览', [currentPage]);

  async function refreshDashboard() {
    setIsLoading(true);
    setError(null);

    try {
      setData(await getDashboardData());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '行情数据加载失败');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshDashboard();
  }, []);

  useEffect(() => {
    const handleHashChange = () => setCurrentPage(getInitialPage());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

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
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <a
                className={`nav-list__item${currentPage === item.key ? ' nav-list__item--active' : ''}`}
                href={`#${item.key}`}
                key={item.key}
              >
                <Icon size={18} aria-hidden="true" />
                {item.label}
              </a>
            );
          })}
        </nav>
        <div className="sidebar__note">
          <span>当前模式</span>
          <strong>{data?.displaySource ?? '实时行情'}</strong>
          <p>{data ? `更新时间：${data.lastUpdated}` : '正在连接公开行情接口。'}</p>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar" id={currentPage}>
          <div>
            <span className="eyebrow">Personal Research Terminal</span>
            <h1>{currentPage === 'overview' ? 'A 股行业分析与选股预警' : pageTitle}</h1>
          </div>
          <div className="topbar__actions">
            <div className="search-box">
              <Search size={17} aria-hidden="true" />
              <span>搜索行业、股票、策略标签</span>
            </div>
            <button className="refresh-button" type="button" onClick={refreshDashboard} disabled={isLoading}>
              <RefreshCw size={16} aria-hidden="true" />
              {isLoading ? '刷新中' : '刷新'}
            </button>
          </div>
        </header>

        {error ? (
          <section className="state-panel" role="alert">
            <AlertTriangle size={22} aria-hidden="true" />
            <div>
              <strong>实时行情加载失败</strong>
              <p>{error}</p>
            </div>
          </section>
        ) : null}

        {!data ? (
          <section className="state-panel">
            <RefreshCw size={22} aria-hidden="true" />
            <div>
              <strong>正在加载真实行情</strong>
              <p>从公开行情接口获取 A 股股票、行业和资金流数据。</p>
            </div>
          </section>
        ) : (
          renderPage(currentPage, data)
        )}
      </div>
    </main>
  );
}
