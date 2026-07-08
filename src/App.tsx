import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
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
  ComposedChart,
  Line,
  LineChart as RechartsLineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MetricCard } from './components/MetricCard';
import { SectionHeader } from './components/SectionHeader';
import { getDashboardData, getTrendIconName } from './data/marketService';
import {
  calculateMovePercent,
  calculateBollingerBands,
  calculateMovingAverageSeries,
  calculatePlotSlotCount,
  calculatePriceDomain,
  calculatePointerPrice,
  calculateRightAlignedPlotX,
  calculateVisibleBars,
  calculateZoomWindow,
  dedupeNearbyPriceLevels,
  deriveAutoLevels,
  fetchKlineData,
  getPointerLabelSide,
  KLINE_PERIODS,
  parseManualLevels,
  resolveSecurityQuery,
  roundPrice,
  searchSecuritySuggestions,
  toggleSelectedLevelIds,
  toggleSelectedStopLevelIds,
} from './data/priceDiscipline';
import type { AlertSignal, DashboardData, TrendDirection } from './data/types';
import type { KlineData, KlinePeriod, PriceLevelType, SecuritySuggestion } from './data/priceDiscipline';

type PageKey = 'overview' | 'industries' | 'watchlist' | 'alerts' | 'toolbox';

type ToolboxItem = {
  id: string;
  name: string;
  url: string;
};

type PriceToolConfig = {
  codeInput: string;
  activeCode: string;
  activeName: string;
  period: KlinePeriod;
  chartType: 'line' | 'area' | 'candlestick';
  chartWindow: number | 'all';
  buyPrice: string;
  manualLevels: string;
  pinnedLevelIds: string[];
  stopLevelIds: string[];
  isCollapsed: boolean;
  showBuy: boolean;
  showStop: boolean;
  showManual: boolean;
  showAuto: boolean;
  showMa: boolean;
  showBoll: boolean;
};

type PriceTableRow = {
  id: string;
  type: PriceLevelType;
  label: string;
  price: number;
  source: string;
  movePercent: number | null;
};

type ChartHoverPoint = {
  time: string;
  close: number;
  plotX: number;
  pointerPrice: number;
  pointerY: number;
  pointerLabelSide: 'left' | 'right';
};

const PRICE_CHART_HEIGHT = 430;
const PRICE_CHART_MARGIN = { left: 0, right: 34, top: 18, bottom: 4 };
const PRICE_CHART_Y_AXIS_WIDTH = 52;
const PRICE_CHART_X_AXIS_HEIGHT = 30;
const PRICE_CHART_PLOT_BOTTOM_MARGIN = PRICE_CHART_MARGIN.bottom + PRICE_CHART_X_AXIS_HEIGHT;
const PRICE_CHART_MIN_CANDLE_SLOTS = 30;

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

const DEFAULT_PRICE_TOOL_CONFIG: PriceToolConfig = {
  codeInput: '300750',
  activeCode: '300750',
  activeName: '',
  period: 'daily',
  chartType: 'line',
  chartWindow: 120,
  buyPrice: '',
  manualLevels: '',
  pinnedLevelIds: [],
  stopLevelIds: [],
  isCollapsed: false,
  showBuy: true,
  showStop: true,
  showManual: true,
  showAuto: true,
  showMa: false,
  showBoll: false,
};

const MOVING_AVERAGE_PERIODS = [5, 10, 20, 60] as const;

const PRICE_TOOL_STORAGE_KEY = 'alpha-desk-price-discipline';

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
                  <Cell key={item.name} fill={item.trend === 'down' ? '#38b894' : item.trend === 'up' ? '#c7646d' : '#d6aa5c'} />
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

function getInitialPriceToolConfig(): PriceToolConfig {
  const saved = window.localStorage.getItem(PRICE_TOOL_STORAGE_KEY);

  if (!saved) {
    return DEFAULT_PRICE_TOOL_CONFIG;
  }

  try {
    const parsed = { ...DEFAULT_PRICE_TOOL_CONFIG, ...(JSON.parse(saved) as Partial<PriceToolConfig>) };
    return {
      ...parsed,
      pinnedLevelIds: Array.isArray(parsed.pinnedLevelIds) ? parsed.pinnedLevelIds : [],
      stopLevelIds: Array.isArray(parsed.stopLevelIds) ? parsed.stopLevelIds : [],
    };
  } catch {
    return DEFAULT_PRICE_TOOL_CONFIG;
  }
}

function getPriceLevelLabel(type: PriceLevelType) {
  if (type === 'buy') {
    return '买入价';
  }

  if (type === 'stop') {
    return '止损价';
  }

  if (type === 'support') {
    return '支撑位';
  }

  if (type === 'resistance') {
    return '压力位';
  }

  return '手动关键价';
}

function getPriceLevelColor(type: PriceLevelType) {
  if (type === 'buy') {
    return '#d6aa5c';
  }

  if (type === 'stop') {
    return '#c7646d';
  }

  if (type === 'support') {
    return '#38b894';
  }

  if (type === 'resistance') {
    return '#5eb6c9';
  }

  return '#b7c4d0';
}

function formatPrice(value: number) {
  return value.toFixed(2);
}

function toChartRows(bars: KlineData['bars']) {
  return bars.map((bar) => {
    const bodyLow = Math.min(bar.open, bar.close);
    const bodyHigh = Math.max(bar.open, bar.close);

    return {
      ...bar,
      wickBase: bar.low,
      wickRange: Math.max(bar.high - bar.low, 0.01),
      bodyBase: bodyLow,
      bodyRange: Math.max(bodyHigh - bodyLow, 0.01),
    };
  });
}

function PriceChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: string | number;
  payload?: Array<{ color?: string; name?: string; value?: number; payload?: { time?: string } }>;
}) {
  if (!active || !payload?.length) {
    return null;
  }

  const rows = payload.filter((item) => Number.isFinite(item.value));
  const time = payload[0]?.payload?.time ?? label;

  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="price-tooltip">
      <strong>{time}</strong>
      {rows.map((item) => {
        const name = item.name === 'close' ? '收盘价' : item.name ?? '价格';

        return (
          <span key={`${name}-${item.value}`} style={{ color: item.color ?? '#dbe5ee' }}>
            {name}：{formatPrice(Number(item.value))}
          </span>
        );
      })}
    </div>
  );
}

function renderCommonChartChrome(
  referenceRows: PriceTableRow[],
  highlightedLevelId: string | null,
  hoverPoint: ChartHoverPoint | null,
  priceDomain: [number, number],
  xDomain: [number, number],
  xTicks: number[],
  formatXTick: (value: number) => string,
  showReferenceRows = true,
) {
  return (
    <>
      <CartesianGrid stroke="#22303a" strokeDasharray="3 3" vertical={false} />
      <XAxis
        dataKey="plotX"
        type="number"
        domain={xDomain}
        ticks={xTicks}
        height={PRICE_CHART_X_AXIS_HEIGHT}
        minTickGap={28}
        tick={{ fill: '#7c8a96', fontSize: 11 }}
        tickFormatter={(value) => formatXTick(Number(value))}
        axisLine={false}
        tickLine={false}
      />
      <YAxis
        allowDataOverflow
        domain={priceDomain}
        tick={{ fill: '#7c8a96', fontSize: 11 }}
        axisLine={false}
        tickLine={false}
        width={PRICE_CHART_Y_AXIS_WIDTH}
      />
      <Tooltip
        content={<PriceChartTooltip />}
        formatter={(value, name) => [`${Number(value).toFixed(2)}`, name === 'close' ? '收盘价' : '价格']}
        contentStyle={{ background: '#101820', border: '1px solid #273542', borderRadius: 6, color: '#dbe5ee' }}
      />
      {showReferenceRows ? referenceRows.map((row) => (
        <ReferenceLine
          ifOverflow="extendDomain"
          key={row.id}
          y={row.price}
          stroke={getPriceLevelColor(row.type)}
          strokeDasharray="5 5"
          strokeOpacity={!highlightedLevelId || highlightedLevelId === row.id ? 0.88 : 0.28}
          strokeWidth={highlightedLevelId === row.id ? 2.4 : 1}
          label={{
            value: `${row.label} ${formatPrice(row.price)}`,
            position: 'right',
            fill: getPriceLevelColor(row.type),
            fontSize: 11,
          }}
        />
      )) : null}
      {hoverPoint ? (
        <>
          {hoverPoint.time ? (
            <ReferenceLine x={hoverPoint.plotX} stroke="#dbe5ee" strokeDasharray="3 3" strokeOpacity={0.42} />
          ) : null}
        </>
      ) : null}
    </>
  );
}

function renderIndicatorLines(config: Pick<PriceToolConfig, 'showMa' | 'showBoll'>) {
  return (
    <>
      {config.showBoll ? (
        <>
          <Line name="BOLL上" type="monotone" dataKey="bollUpper" dot={false} stroke="#cbd5e1" strokeWidth={1.25} strokeDasharray="5 5" connectNulls />
          <Line name="BOLL中" type="monotone" dataKey="bollMid" dot={false} stroke="#94a3b8" strokeWidth={1.1} strokeDasharray="2 5" connectNulls />
          <Line name="BOLL下" type="monotone" dataKey="bollLower" dot={false} stroke="#cbd5e1" strokeWidth={1.25} strokeDasharray="5 5" connectNulls />
        </>
      ) : null}
      {config.showMa ? (
        <>
          <Line name="MA5" type="monotone" dataKey="ma5" dot={false} stroke="#22d3ee" strokeWidth={1.45} strokeDasharray="8 4" strokeOpacity={0.78} connectNulls />
          <Line name="MA10" type="monotone" dataKey="ma10" dot={false} stroke="#a78bfa" strokeWidth={1.4} strokeDasharray="5 5" strokeOpacity={0.74} connectNulls />
          <Line name="MA20" type="monotone" dataKey="ma20" dot={false} stroke="#fb7185" strokeWidth={1.35} strokeDasharray="3 6" strokeOpacity={0.7} connectNulls />
          <Line name="MA60" type="monotone" dataKey="ma60" dot={false} stroke="#4ade80" strokeWidth={1.3} strokeDasharray="10 5 2 5" strokeOpacity={0.66} connectNulls />
        </>
      ) : null}
    </>
  );
}

function CandlestickOverlay({
  rows,
  priceDomain,
  width,
  referenceRows,
  highlightedLevelId,
}: {
  rows: Array<ReturnType<typeof toChartRows>[number] & { plotX: number }>;
  priceDomain: [number, number];
  width: number;
  referenceRows: PriceTableRow[];
  highlightedLevelId: string | null;
}) {
  if (width <= 0 || rows.length === 0) {
    return null;
  }

  const plotLeft = PRICE_CHART_Y_AXIS_WIDTH;
  const plotRight = PRICE_CHART_MARGIN.right;
  const plotTop = PRICE_CHART_MARGIN.top;
  const plotBottom = PRICE_CHART_HEIGHT - PRICE_CHART_PLOT_BOTTOM_MARGIN;
  const plotWidth = Math.max(width - plotLeft - plotRight, 1);
  const plotHeight = Math.max(plotBottom - plotTop, 1);
  const [minPrice, maxPrice] = priceDomain;
  const priceRange = Math.max(maxPrice - minPrice, 0.01);
  const slotCount = calculatePlotSlotCount(rows.length, PRICE_CHART_MIN_CANDLE_SLOTS);
  const step = slotCount > 1 ? plotWidth / (slotCount - 1) : plotWidth;
  const bodyWidth = Math.min(Math.max(step * 0.62, 3), 22);
  const yForPrice = (price: number) => plotTop + ((maxPrice - price) / priceRange) * plotHeight;

  return (
    <svg className="price-candles" width={width} height={PRICE_CHART_HEIGHT} aria-hidden="true">
      {referenceRows.map((row) => {
        const y = yForPrice(row.price);
        const color = getPriceLevelColor(row.type);
        const isActive = !highlightedLevelId || highlightedLevelId === row.id;

        return (
          <g key={`candle-ref-${row.id}`}>
            <line
              x1={plotLeft}
              x2={width - plotRight}
              y1={y}
              y2={y}
              stroke={color}
              strokeDasharray="5 5"
              strokeOpacity={isActive ? 0.88 : 0.28}
              strokeWidth={highlightedLevelId === row.id ? 2.4 : 1}
            />
            <text
              x={width - plotRight + 4}
              y={y + 4}
              fill={color}
              fontSize={11}
              textAnchor="start"
            >
              {row.label}
            </text>
          </g>
        );
      })}
      {rows.map((row) => {
        const x = plotLeft + (slotCount > 1 ? step * row.plotX : plotWidth / 2);
        const highY = yForPrice(row.high);
        const lowY = yForPrice(row.low);
        const openY = yForPrice(row.open);
        const closeY = yForPrice(row.close);
        const bodyTop = Math.min(openY, closeY);
        const bodyHeight = Math.max(Math.abs(openY - closeY), 2);
        const color = row.close >= row.open ? '#c7646d' : '#38d6b2';

        return (
          <g key={`candle-${row.time}`} stroke={color} fill={color}>
            <line x1={x} x2={x} y1={highY} y2={lowY} strokeWidth={1.4} />
            <rect
              x={x - bodyWidth / 2}
              y={bodyTop}
              width={bodyWidth}
              height={bodyHeight}
              rx={1}
              strokeWidth={1}
              fillOpacity={0.82}
            />
          </g>
        );
      })}
    </svg>
  );
}

function PriceDisciplinePanel() {
  const chartShellRef = useRef<HTMLDivElement | null>(null);
  const chartCanvasRef = useRef<HTMLDivElement | null>(null);
  const [config, setConfig] = useState<PriceToolConfig>(getInitialPriceToolConfig);
  const [chartCanvasWidth, setChartCanvasWidth] = useState(0);
  const [klineData, setKlineData] = useState<KlineData | null>(null);
  const [isLoadingKline, setIsLoadingKline] = useState(false);
  const [klineError, setKlineError] = useState<string | null>(null);
  const [hoverPoint, setHoverPoint] = useState<ChartHoverPoint | null>(null);
  const [highlightedLevelId, setHighlightedLevelId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<SecuritySuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const buyPrice = Number(config.buyPrice);
  const hasBuyPrice = Number.isFinite(buyPrice) && buyPrice > 0;
  const manualPrices = useMemo(() => parseManualLevels(config.manualLevels), [config.manualLevels]);
  const autoLevels = useMemo(() => deriveAutoLevels(klineData?.bars ?? []), [klineData]);
  const chartRows = useMemo(
    () => {
      const visibleBars = calculateVisibleBars(klineData?.bars ?? [], config.chartWindow);
      const minimumSlots = config.chartType === 'candlestick' ? PRICE_CHART_MIN_CANDLE_SLOTS : 1;
      const slotCount = calculatePlotSlotCount(visibleBars.length, minimumSlots);
      const movingAverages = Object.fromEntries(
        MOVING_AVERAGE_PERIODS.map((period) => [period, calculateMovingAverageSeries(visibleBars, period)]),
      ) as Record<(typeof MOVING_AVERAGE_PERIODS)[number], Array<number | null>>;
      const bollingerBands = calculateBollingerBands(visibleBars, 20, 2);

      return toChartRows(visibleBars).map((row, index) => ({
        ...row,
        plotX: calculateRightAlignedPlotX(index, visibleBars.length, slotCount),
        ma5: movingAverages[5][index],
        ma10: movingAverages[10][index],
        ma20: movingAverages[20][index],
        ma60: movingAverages[60][index],
        bollMid: bollingerBands[index]?.mid ?? null,
        bollUpper: bollingerBands[index]?.upper ?? null,
        bollLower: bollingerBands[index]?.lower ?? null,
      }));
    },
    [config.chartType, config.chartWindow, klineData],
  );
  const chartSlotCount = useMemo(
    () => calculatePlotSlotCount(chartRows.length, config.chartType === 'candlestick' ? PRICE_CHART_MIN_CANDLE_SLOTS : 1),
    [chartRows.length, config.chartType],
  );
  const chartXDomain = useMemo<[number, number]>(
    () => [0, Math.max(chartSlotCount - 1, 0)],
    [chartSlotCount],
  );
  const chartTickLabels = useMemo(() => {
    const labels = new Map<number, string>();
    chartRows.forEach((row) => labels.set(row.plotX, row.time));
    return labels;
  }, [chartRows]);
  const chartXTicks = useMemo(() => {
    if (chartRows.length <= 6) {
      return chartRows.map((row) => row.plotX);
    }

    const interval = Math.ceil((chartRows.length - 1) / 5);
    return chartRows
      .filter((_, index) => index === chartRows.length - 1 || index % interval === 0)
      .map((row) => row.plotX);
  }, [chartRows]);
  const tableRows = useMemo<PriceTableRow[]>(() => {
    const rows: PriceTableRow[] = [];

    if (hasBuyPrice) {
      rows.push({
        id: 'buy',
        type: 'buy',
        label: getPriceLevelLabel('buy'),
        price: roundPrice(buyPrice),
        source: '输入',
        movePercent: 0,
      });
    }

    manualPrices.forEach((price, index) => {
      const type = hasBuyPrice && price < buyPrice ? 'support' : hasBuyPrice && price > buyPrice ? 'resistance' : 'manual';
      rows.push({
        id: `manual-${index}-${price}`,
        type,
        label: getPriceLevelLabel(type),
        price,
        source: '手动',
        movePercent: hasBuyPrice ? calculateMovePercent(buyPrice, price) : null,
      });
    });

    autoLevels.forEach((level) => {
      rows.push({
        id: level.id,
        type: level.type,
        label: getPriceLevelLabel(level.type),
        price: level.price,
        source: `自动${level.strength ? ` ${level.strength}` : ''}`,
        movePercent: hasBuyPrice ? calculateMovePercent(buyPrice, level.price) : null,
      });
    });

    return rows.sort((a, b) => a.price - b.price);
  }, [autoLevels, buyPrice, hasBuyPrice, manualPrices]);
  const pinnedLevelIds = useMemo(() => new Set(config.pinnedLevelIds), [config.pinnedLevelIds]);
  const selectedStopIds = useMemo(() => new Set(config.stopLevelIds), [config.stopLevelIds]);
  const referenceRows = dedupeNearbyPriceLevels(tableRows
    .filter((row) => {
      const isPinned = pinnedLevelIds.has(row.id) && row.type !== 'buy';
      const isSelectedStop = selectedStopIds.has(row.id) && row.type !== 'buy';

      if (row.id === highlightedLevelId) {
        return true;
      }

      if (isPinned) {
        return true;
      }

      if (isSelectedStop) {
        return config.showStop;
      }

      if (row.type === 'buy') {
        return config.showBuy;
      }

      if (row.source === '手动') {
        return config.showManual;
      }

      if (row.source.startsWith('自动')) {
        return config.showAuto;
      }

      return true;
    })
    .map((row) => (
      selectedStopIds.has(row.id) && row.type !== 'buy'
        ? { ...row, type: 'stop' as const, label: getPriceLevelLabel('stop') }
        : row
    )), highlightedLevelId);
  const indicatorPrices = useMemo(() => chartRows.flatMap((row) => {
    const prices: Array<number | null | undefined> = [];

    if (config.showMa) {
      prices.push(row.ma5, row.ma10, row.ma20, row.ma60);
    }

    if (config.showBoll) {
      prices.push(row.bollMid, row.bollUpper, row.bollLower);
    }

    return prices.filter((price): price is number => Number.isFinite(price));
  }), [chartRows, config.showBoll, config.showMa]);
  const chartPriceDomain = useMemo(
    () => calculatePriceDomain(chartRows, [...referenceRows.map((row) => row.price), ...indicatorPrices]),
    [chartRows, indicatorPrices, referenceRows],
  );

  useEffect(() => {
    window.localStorage.setItem(PRICE_TOOL_STORAGE_KEY, JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    let isStale = false;

    async function loadKline() {
      const code = config.activeCode.trim();

      if (!code) {
        return;
      }

      setIsLoadingKline(true);
      setKlineError(null);

      try {
        const result = await fetchKlineData({ code, period: config.period });

        if (!isStale) {
          setKlineData(result);
        }
      } catch (caught) {
        if (!isStale) {
          setKlineError(caught instanceof Error ? caught.message : 'K线数据加载失败');
        }
      } finally {
        if (!isStale) {
          setIsLoadingKline(false);
        }
      }
    }

    void loadKline();

    return () => {
      isStale = true;
    };
  }, [config.activeCode, config.period]);

  useEffect(() => {
    const query = config.codeInput.trim();
    let isStale = false;

    if (query.length < 1) {
      setSuggestions([]);
      return;
    }

    if (config.activeCode && query === `${config.activeName} ${config.activeCode}`.trim()) {
      setSuggestions([]);
      return;
    }

    const timer = window.setTimeout(() => {
      setIsLoadingSuggestions(true);

      searchSecuritySuggestions(query)
        .then((items) => {
          if (!isStale) {
            setSuggestions(items);
          }
        })
        .catch(() => {
          if (!isStale) {
            setSuggestions([]);
          }
        })
        .finally(() => {
          if (!isStale) {
            setIsLoadingSuggestions(false);
          }
        });
    }, 250);

    return () => {
      isStale = true;
      window.clearTimeout(timer);
    };
  }, [config.codeInput]);

  function updateConfig(patch: Partial<PriceToolConfig>) {
    setConfig((current) => ({ ...current, ...patch }));
  }

  function togglePinnedLevel(row: PriceTableRow, checked: boolean) {
    if (row.type === 'buy') {
      return;
    }

    updateConfig({
      pinnedLevelIds: toggleSelectedLevelIds(config.pinnedLevelIds, row.id, checked),
    });
  }

  function toggleStopLevel(row: PriceTableRow, checked: boolean) {
    if (row.type === 'buy') {
      return;
    }

    updateConfig({
      stopLevelIds: toggleSelectedStopLevelIds(config.stopLevelIds, row.id, checked),
    });
  }

  function applyChartZoom(deltaY: number) {
    updateConfig({
      chartWindow: calculateZoomWindow(
        config.chartWindow,
        klineData?.bars.length ?? chartRows.length,
        deltaY < 0 ? 'in' : 'out',
      ),
    });
  }

  function applySecuritySuggestion(suggestion: SecuritySuggestion) {
    updateConfig({
      codeInput: suggestion.name ? `${suggestion.name} ${suggestion.code}` : suggestion.code,
      activeCode: suggestion.code,
      activeName: suggestion.name,
    });
    setSuggestions([]);
  }

  async function refreshActiveCode() {
    const nextCode = config.codeInput.trim();

    if (!nextCode) {
      return;
    }

    setIsLoadingKline(true);
    setKlineError(null);

    try {
      const resolved = await resolveSecurityQuery(nextCode);
      updateConfig({
        codeInput: resolved.name ? `${resolved.name} ${resolved.code}` : resolved.code,
        activeCode: resolved.code,
        activeName: resolved.name,
      });
    } catch (caught) {
      setKlineError(caught instanceof Error ? caught.message : '股票或ETF解析失败');
    } finally {
      setIsLoadingKline(false);
    }
  }

  function handleChartMouseMove(state: unknown) {
    const payload = state as {
      activeLabel?: string;
      activePayload?: Array<{ payload?: { time?: string; close?: number; plotX?: number } }>;
    };
    const point = payload.activePayload?.[0]?.payload;

    if (!payload.activeLabel || !point || typeof point.close !== 'number') {
      return;
    }

    setHoverPoint((current) => ({
      time: point.time ?? payload.activeLabel ?? current?.time ?? '',
      close: point.close ?? current?.close ?? 0,
      plotX: point.plotX ?? current?.plotX ?? 0,
      pointerY: current?.pointerY ?? PRICE_CHART_HEIGHT / 2,
      pointerPrice: current?.pointerPrice ?? point.close ?? 0,
      pointerLabelSide: current?.pointerLabelSide ?? 'right',
    }));
  }

  function handleChartCanvasMouseMove(event: ReactMouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const pointerX = event.clientX - rect.left;
    const pointerY = Math.min(
      Math.max(event.clientY - rect.top, PRICE_CHART_MARGIN.top),
      PRICE_CHART_HEIGHT - PRICE_CHART_PLOT_BOTTOM_MARGIN,
    );

    setHoverPoint((current) => ({
      time: current?.time ?? '',
      close: current?.close ?? 0,
      plotX: current?.plotX ?? 0,
      pointerY,
      pointerLabelSide: getPointerLabelSide(pointerX, rect.width),
      pointerPrice: calculatePointerPrice(
        pointerY,
        PRICE_CHART_HEIGHT,
        PRICE_CHART_MARGIN.top,
        PRICE_CHART_PLOT_BOTTOM_MARGIN,
        chartPriceDomain,
      ),
    }));
  }

  useEffect(() => {
    const chartShell = chartShellRef.current;

    if (!chartShell) {
      return undefined;
    }

    function handleNativeWheel(event: globalThis.WheelEvent) {
      event.preventDefault();
      event.stopPropagation();
      applyChartZoom(event.deltaY);
    }

    chartShell.addEventListener('wheel', handleNativeWheel, { passive: false });

    return () => {
      chartShell.removeEventListener('wheel', handleNativeWheel);
    };
  }, [config.chartWindow, klineData?.bars.length, chartRows.length]);

  useEffect(() => {
    const chartCanvas = chartCanvasRef.current;

    if (!chartCanvas) {
      return undefined;
    }

    const updateWidth = () => setChartCanvasWidth(chartCanvas.getBoundingClientRect().width);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(chartCanvas);

    return () => observer.disconnect();
  }, []);

  const headerTitle = config.isCollapsed
    ? `价格纪律${config.activeCode ? ` · ${config.activeName || config.activeCode}` : ''}`
    : '价格纪律';
  const indicatorMode = config.showMa && config.showBoll ? 'all' : config.showMa ? 'ma' : config.showBoll ? 'boll' : 'none';

  return (
    <section className={`panel price-tool${config.isCollapsed ? ' price-tool--collapsed' : ''}`}>
      <div className="section-header price-tool__header">
        <div>
          <span>Price Discipline</span>
          <h2>{headerTitle}</h2>
        </div>
        <button
          type="button"
          className="icon-button"
          onClick={() => updateConfig({ isCollapsed: !config.isCollapsed })}
          aria-label={config.isCollapsed ? '展开价格纪律' : '折叠价格纪律'}
        >
          <CandlestickChart size={16} aria-hidden="true" />
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      {config.isCollapsed ? null : (
        <>

      <div className="price-tool__controls">
        <label>
          <span>股票 / ETF 名称或代码</span>
          <div className="price-tool__code">
            <input
              value={config.codeInput}
              onChange={(event) => updateConfig({ codeInput: event.target.value })}
              placeholder="例如 亚翔集成 或 603929"
            />
            <button type="button" onClick={refreshActiveCode} disabled={isLoadingKline}>
              <RefreshCw size={15} aria-hidden="true" />
              刷新
            </button>
          </div>
          {isLoadingSuggestions || suggestions.length > 0 ? (
            <div className="security-suggestions">
              {isLoadingSuggestions ? <span className="security-suggestions__state">搜索中</span> : null}
              {suggestions.map((suggestion) => (
                <button key={suggestion.code} type="button" onClick={() => applySecuritySuggestion(suggestion)}>
                  <strong>{suggestion.name}</strong>
                  <span>{suggestion.code}</span>
                </button>
              ))}
            </div>
          ) : null}
        </label>

        <label>
          <span>买入价</span>
          <input
            value={config.buyPrice}
            onChange={(event) => updateConfig({ buyPrice: event.target.value })}
            inputMode="decimal"
            placeholder="输入你的买入价"
          />
        </label>

        <label>
          <span>K线周期</span>
          <select value={config.period} onChange={(event) => updateConfig({ period: event.target.value as KlinePeriod })}>
            {KLINE_PERIODS.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>图形</span>
          <select
            value={config.chartType}
            onChange={(event) => updateConfig({ chartType: event.target.value as PriceToolConfig['chartType'] })}
          >
            <option value="line">曲线</option>
            <option value="area">面积</option>
            <option value="candlestick">K线</option>
          </select>
        </label>

        <label>
          <span>显示范围</span>
          <select
            value={String(config.chartWindow)}
            onChange={(event) => {
              const value = event.target.value;
              updateConfig({ chartWindow: value === 'all' ? 'all' : (Number(value) as PriceToolConfig['chartWindow']) });
            }}
          >
            {config.chartWindow !== 'all' && ![30, 60, 120].includes(config.chartWindow) ? (
              <option value={String(config.chartWindow)}>{`最近${config.chartWindow}根`}</option>
            ) : null}
            <option value="30">最近30根</option>
            <option value="60">最近60根</option>
            <option value="120">最近120根</option>
            <option value="all">全部</option>
          </select>
        </label>
      </div>

      <div className="price-tool__layout">
        <div className="price-chart" ref={chartShellRef}>
          <div className="price-chart__top">
            <div>
              <strong>{klineData ? `${config.activeName || klineData.name} ${klineData.code}` : config.activeCode}</strong>
              <span>{KLINE_PERIODS.find((period) => period.value === config.period)?.label} 价格图</span>
              <label className="price-indicator-select">
                <span>指标</span>
                <select
                  value={indicatorMode}
                  onChange={(event) => {
                    const value = event.target.value;
                    updateConfig({
                      showMa: value === 'ma' || value === 'all',
                      showBoll: value === 'boll' || value === 'all',
                    });
                  }}
                >
                  <option value="none">无指标</option>
                  <option value="ma">均线</option>
                  <option value="boll">BOLL</option>
                  <option value="all">均线 + BOLL</option>
                </select>
              </label>
              {indicatorMode !== 'none' ? (
                <div className="price-indicator-legend" aria-label="指标图例">
                  {config.showMa ? (
                    <>
                      <span><i className="ma ma--5" />MA5</span>
                      <span><i className="ma ma--10" />MA10</span>
                      <span><i className="ma ma--20" />MA20</span>
                      <span><i className="ma ma--60" />MA60</span>
                    </>
                  ) : null}
                  {config.showBoll ? (
                    <>
                      <span><i className="dash" style={{ color: '#cbd5e1' }} />BOLL上/下</span>
                      <span><i className="dash" style={{ color: '#94a3b8' }} />BOLL中</span>
                    </>
                  ) : null}
                </div>
              ) : null}
            </div>
            <span>{isLoadingKline ? '加载中' : klineData ? `${klineData.bars.length} 根K线` : '暂无数据'}</span>
          </div>

          {klineError ? (
            <div className="price-chart__state">{klineError}</div>
          ) : (
            <div
              className="price-chart__canvas"
              ref={chartCanvasRef}
              onMouseMove={handleChartCanvasMouseMove}
              onMouseLeave={() => setHoverPoint(null)}
            >
              <ResponsiveContainer width="100%" height={PRICE_CHART_HEIGHT}>
              {config.chartType === 'candlestick' ? (
                <ComposedChart
                  data={chartRows}
                  margin={PRICE_CHART_MARGIN}
                  onMouseMove={handleChartMouseMove}
                  onMouseLeave={() => setHoverPoint(null)}
                >
                  {renderCommonChartChrome(referenceRows, highlightedLevelId, hoverPoint, chartPriceDomain, chartXDomain, chartXTicks, (value) => chartTickLabels.get(value) ?? '', false)}
                  <Line name="收盘价" type="monotone" dataKey="close" dot={false} stroke="transparent" strokeWidth={1} activeDot={false} />
                  {renderIndicatorLines(config)}
                </ComposedChart>
              ) : (
                <RechartsLineChart
                  data={chartRows}
                  margin={PRICE_CHART_MARGIN}
                  onMouseMove={handleChartMouseMove}
                  onMouseLeave={() => setHoverPoint(null)}
                >
                  {renderCommonChartChrome(referenceRows, highlightedLevelId, hoverPoint, chartPriceDomain, chartXDomain, chartXTicks, (value) => chartTickLabels.get(value) ?? '')}
                  {config.chartType === 'area' ? (
                    <Area name="收盘价" type="monotone" dataKey="close" stroke="#d6aa5c" fill="#d6aa5c" fillOpacity={0.16} dot={false} />
                  ) : (
                    <Line name="收盘价" type="monotone" dataKey="close" dot={false} stroke="#d6aa5c" strokeWidth={2} />
                  )}
                  {renderIndicatorLines(config)}
                </RechartsLineChart>
              )}
              </ResponsiveContainer>
              {config.chartType === 'candlestick' ? (
                <CandlestickOverlay
                  rows={chartRows}
                  priceDomain={chartPriceDomain}
                  width={chartCanvasWidth}
                  referenceRows={referenceRows}
                  highlightedLevelId={highlightedLevelId}
                />
              ) : null}
              {hoverPoint ? (
                <div
                  className={`price-cursor-line price-cursor-line--${hoverPoint.pointerLabelSide}`}
                  style={{ top: `${hoverPoint.pointerY}px` }}
                  aria-hidden="true"
                >
                  <span>{formatPrice(hoverPoint.pointerPrice)}</span>
                </div>
              ) : null}
            </div>
          )}

          <details className="price-annotation-settings">
            <summary>标注设置</summary>
            <div className="price-annotation-settings__body">
              <div className="annotation-switches">
                {[
                  ['showBuy', '显示买入价'],
                  ['showStop', '显示止损价'],
                  ['showManual', '显示手动关键价'],
                  ['showAuto', '显示自动关键价'],
                ].map(([key, label]) => (
                  <label key={key}>
                    <input
                      type="checkbox"
                      checked={Boolean(config[key as keyof PriceToolConfig])}
                      onChange={(event) => updateConfig({ [key]: event.target.checked } as Partial<PriceToolConfig>)}
                    />
                    <span>{label}</span>
                  </label>
                ))}
              </div>

              <label className="manual-levels">
                <span>手动关键价</span>
                <textarea
                  value={config.manualLevels}
                  onChange={(event) => updateConfig({ manualLevels: event.target.value })}
                  placeholder="例如：370, 385&#10;支持逗号、空格或换行"
                />
              </label>
            </div>
          </details>
        </div>

        <aside className="price-tool__side">
          <div className="annotation-switches">
            {[
              ['showBuy', '显示买入价'],
              ['showStop', '显示止损价'],
              ['showManual', '显示手动关键价'],
              ['showAuto', '显示自动关键价'],
            ].map(([key, label]) => (
              <label key={key}>
                <input
                  type="checkbox"
                  checked={Boolean(config[key as keyof PriceToolConfig])}
                  onChange={(event) => updateConfig({ [key]: event.target.checked } as Partial<PriceToolConfig>)}
                />
                <span>{label}</span>
              </label>
            ))}
          </div>

          <label className="manual-levels">
            <span>手动关键价</span>
            <textarea
              value={config.manualLevels}
              onChange={(event) => updateConfig({ manualLevels: event.target.value })}
              placeholder="例如：370, 385&#10;支持逗号、空格或换行"
            />
          </label>

          <div className="price-level-table" role="table" aria-label="关键价格涨跌幅">
            <div className="price-level-table__head" role="row">
              <span>固定</span>
              <span>止损</span>
              <span>类型</span>
              <span>价格</span>
              <span>相对买入价</span>
              <span>来源</span>
            </div>
            <div className="price-level-table__body">
              {tableRows.length > 0 ? (
                tableRows.map((row) => (
                  <article
                    className={`price-level-row${highlightedLevelId === row.id ? ' price-level-row--active' : ''}`}
                    key={row.id}
                    onMouseEnter={() => setHighlightedLevelId(row.id)}
                    onMouseLeave={() => setHighlightedLevelId(null)}
                    role="row"
                  >
                    <label className="price-level-row__check" aria-label={`固定显示 ${formatPrice(row.price)}`}>
                      <input
                        type="checkbox"
                        checked={pinnedLevelIds.has(row.id)}
                        disabled={row.type === 'buy'}
                        onChange={(event) => togglePinnedLevel(row, event.target.checked)}
                      />
                    </label>
                    <label className="price-level-row__check" aria-label={`设为止损价 ${formatPrice(row.price)}`}>
                      <input
                        type="checkbox"
                        checked={selectedStopIds.has(row.id)}
                        disabled={row.type === 'buy'}
                        onChange={(event) => toggleStopLevel(row, event.target.checked)}
                      />
                    </label>
                    <span style={{ color: getPriceLevelColor(row.type) }}>{row.label}</span>
                    <strong>{formatPrice(row.price)}</strong>
                    <span className={(row.movePercent ?? 0) >= 0 ? 'positive' : 'negative'}>
                      {row.movePercent === null ? '-' : `${row.movePercent > 0 ? '+' : ''}${row.movePercent.toFixed(2)}%`}
                    </span>
                    <span>{row.source}</span>
                  </article>
                ))
              ) : (
                <div className="price-level-table__empty">输入买入价或关键价后显示纪律计算结果。</div>
              )}
            </div>
          </div>
        </aside>
      </div>
        </>
      )}
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
  const [isPriceToolOpen, setIsPriceToolOpen] = useState(false);

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
        <article className="tool-card tool-card--builtin">
          <button
            className="tool-card__launch"
            type="button"
            onClick={() => setIsPriceToolOpen((current) => !current)}
            aria-expanded={isPriceToolOpen}
          >
            <div>
              <strong>价格纪律</strong>
              <span>内置工具 · K线关键价与止损测算</span>
            </div>
            <CandlestickChart size={18} aria-hidden="true" />
          </button>
        </article>

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

      {isPriceToolOpen ? <PriceDisciplinePanel /> : null}
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
