const EASTMONEY_TOKEN = 'D43BF722C8E33A6';
const CNINFO_REPORT_CATEGORIES = [
  'category_ndbg_szsh',
  'category_bndbg_szsh',
  'category_yjdbg_szsh',
  'category_sjdbg_szsh',
  'category_yjygjxz_szsh',
];
const METRIC_CATALOG = [
  { id: 'revenue', label: '营业收入', unit: '元', category: '成长', chartType: 'bar', source: 'main', valueField: 'TOTALOPERATEREVE', yoyField: 'TOTALOPERATEREVETZ', qoqField: 'YYZSRGDHBZC' },
  { id: 'netProfit', label: '归母净利润', unit: '元', category: '成长', chartType: 'bar', source: 'main', valueField: 'PARENTNETPROFIT', yoyField: 'PARENTNETPROFITTZ', qoqField: 'NETPROFITRPHBZC' },
  { id: 'deductedNetProfit', label: '扣非净利润', unit: '元', category: '成长', chartType: 'bar', source: 'main', valueField: 'KCFJCXSYJLR', yoyField: 'KCFJCXSYJLRTZ' },
  { id: 'grossMargin', label: '毛利率', unit: '%', category: '盈利', chartType: 'line', source: 'main', valueField: 'XSMLL' },
  { id: 'netMargin', label: '净利率', unit: '%', category: '盈利', chartType: 'line', source: 'main', valueField: 'XSJLL' },
  { id: 'roe', label: 'ROE', unit: '%', category: '盈利', chartType: 'line', source: 'main', valueField: 'ROEJQ' },
  { id: 'cashRevenueRatio', label: '经营现金流/收入', unit: '%', category: '现金流', chartType: 'line', source: 'main', valueField: 'JYXJLYYSR' },
  { id: 'operatingCashPerShare', label: '每股经营现金流', unit: '元/股', category: '现金流', chartType: 'line', source: 'main', valueField: 'MGJYXJJE' },
  { id: 'operatingCashFlow', label: '经营现金流净额', unit: '元', category: '现金流', chartType: 'bar', source: 'cashflow', valueField: 'NETCASH_OPERATE' },
  { id: 'debtAssetRatio', label: '资产负债率', unit: '%', category: '资产负债', chartType: 'line', source: 'balance', valueField: 'DEBT_ASSET_RATIO' },
  { id: 'monetaryFunds', label: '货币资金', unit: '元', category: '资产负债', chartType: 'bar', source: 'balance', valueField: 'MONETARYFUNDS', yoyField: 'MONETARYFUNDS_RATIO' },
  { id: 'accountsReceivable', label: '应收账款', unit: '元', category: '资产负债', chartType: 'bar', source: 'balance', valueField: 'ACCOUNTS_RECE', yoyField: 'ACCOUNTS_RECE_RATIO' },
  { id: 'inventory', label: '存货', unit: '元', category: '资产负债', chartType: 'bar', source: 'balance', valueField: 'INVENTORY', yoyField: 'INVENTORY_RATIO' },
  { id: 'eps', label: '基本 EPS', unit: '元/股', category: '每股指标', chartType: 'line', source: 'main', valueField: 'EPSJB' },
  { id: 'bps', label: '每股净资产', unit: '元/股', category: '每股指标', chartType: 'line', source: 'main', valueField: 'BPS' },
  { id: 'undistributedProfitPerShare', label: '每股未分配利润', unit: '元/股', category: '每股指标', chartType: 'line', source: 'main', valueField: 'MGWFPLR' },
];
const PEER_LIST_URL =
  'https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=5000&po=1&np=1&ut=bd1d9ddb04089700cf9c27f6f7426281&fltt=2&invt=2&fid=f20&fs=m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23&fields=f12,f14,f20,f100';
const INDUSTRY_BOARD_FALLBACKS = [
  { pattern: /电池/, boardCode: 'BK1092' },
  { pattern: /半导体/, boardCode: 'BK1036' },
  { pattern: /通信设备/, boardCode: 'BK0448' },
  { pattern: /光纤/, boardCode: 'BK1660' },
];

export async function handleFinancialReportRequest(request) {
  try {
    if (request.method === 'OPTIONS') {
      return withCors(new Response(null, { status: 204 }));
    }

    const url = new URL(request.url);

    if (request.method === 'GET' && url.pathname === '/') {
      return jsonResponse({
        name: 'A股财报分析 API',
        status: 'ok',
        frontend: 'http://localhost:5173/#toolbox',
        endpoints: [
          '/api/securities/search?q=603929',
          '/api/filings?code=603929&type=all',
          'POST /api/filings/analyze',
        ],
        note: '8787 是后端 API 端口，正式工具界面请打开 frontend 地址。',
      });
    }

    if (request.method === 'GET' && url.pathname === '/api/securities/search') {
      const query = (url.searchParams.get('q') ?? '').trim();
      return jsonResponse({ securities: await searchSecurities(query) });
    }

    if (request.method === 'GET' && url.pathname === '/api/filings') {
      const code = (url.searchParams.get('code') ?? '').trim();
      const type = url.searchParams.get('type') ?? 'all';
      const filings = await getFilings(code, type);
      return jsonResponse({ filings });
    }

    if (request.method === 'GET' && url.pathname === '/api/financial-metrics') {
      const code = (url.searchParams.get('code') ?? '').trim();
      const period = url.searchParams.get('period') === 'annual' ? 'annual' : 'quarterly';
      const includePeers = url.searchParams.get('includePeers') === 'true';
      const peerCount = clamp(Math.round(Number(url.searchParams.get('peerCount') ?? 5)), 0, 5);
      return jsonResponse(await getFinancialMetrics(code, { period, includePeers, peerCount }));
    }

    if (request.method === 'GET' && url.pathname === '/api/industry-companies') {
      const boardCode = (url.searchParams.get('boardCode') ?? '').trim();
      return jsonResponse({ companies: await getIndustryCompanies(boardCode) });
    }

    if (request.method === 'GET' && url.pathname === '/api/industry-boards') {
      const page = clamp(Math.round(Number(url.searchParams.get('pn') ?? 1)), 1, 20);
      return jsonResponse(await getMarketListPage('industry', page));
    }

    if (request.method === 'GET' && url.pathname === '/api/market-stocks') {
      return jsonResponse(await getMarketListPage('stocks', 1));
    }

    if (request.method === 'GET' && url.pathname === '/api/market-kline') {
      return jsonResponse(await getMarketKline(url.searchParams));
    }

    if (request.method === 'GET' && url.pathname === '/api/security-metrics') {
      return jsonResponse(await getSecurityMetrics((url.searchParams.get('code') ?? '').trim()));
    }

    if (request.method === 'POST' && url.pathname === '/api/filings/analyze') {
      const body = await readRequestJson(request);
      const code = String(body.code ?? '').trim();
      const filingId = String(body.filingId ?? '').trim();
      const analysis = await buildRealAnalysis(code, filingId);
      return jsonResponse({ analysis });
    }

    return jsonResponse({ message: 'Not found' }, 404);
  } catch (error) {
    return jsonResponse({ message: error instanceof Error ? error.message : 'Unknown API error' }, 500);
  }
}

function getMarketSecid(code) {
  if (!/^\d{6}$/.test(code)) throw new Error('Invalid security code');
  return /^000(016|300|905|852)$/.test(code) || /^[659]/.test(code) ? `1.${code}` : `0.${code}`;
}

async function getMarketKline(params) {
  const code = (params.get('code') ?? '').trim();
  const klt = params.get('klt') ?? '101';
  if (!['15', '30', '60', '101', '102'].includes(klt)) throw new Error('Invalid kline period');
  const limit = clamp(Math.round(Number(params.get('limit') ?? 180)), 1, 2000);
  const url = new URL('https://push2his.eastmoney.com/api/qt/stock/kline/get');
  url.searchParams.set('secid', getMarketSecid(code));
  url.searchParams.set('klt', klt); url.searchParams.set('fqt', '1'); url.searchParams.set('lmt', String(limit));
  url.searchParams.set('end', '20500101'); url.searchParams.set('iscca', '1');
  url.searchParams.set('fields1', 'f1,f2,f3,f4,f5,f6');
  url.searchParams.set('fields2', 'f51,f52,f53,f54,f55,f56,f57,f58');
  try { return await fetchJson(url); } catch { return fetchJson(url); }
}

async function getSecurityMetrics(code) {
  const hosts = ['push2.eastmoney.com', 'push2delay.eastmoney.com'];
  let lastError;
  for (const host of hosts) {
    const url = new URL(`https://${host}/api/qt/stock/get`);
    url.searchParams.set('secid', getMarketSecid(code));
    url.searchParams.set('fields', 'f43,f162,f116,f170');
    try { return await fetchJson(url); } catch (error) { lastError = error; }
  }
  throw lastError ?? new Error('Security metrics unavailable');
}

async function getIndustryCompanies(boardCode) {
  if (!/^BK\d{4}$/.test(boardCode)) {
    throw new Error('Invalid industry board code');
  }
  const url = new URL('https://push2delay.eastmoney.com/api/qt/clist/get');
  url.searchParams.set('pn', '1');
  url.searchParams.set('pz', '100');
  url.searchParams.set('po', '1');
  url.searchParams.set('np', '1');
  url.searchParams.set('ut', 'bd1d9ddb04089700cf9c27f6f7426281');
  url.searchParams.set('fltt', '2');
  url.searchParams.set('invt', '2');
  url.searchParams.set('fid', 'f3');
  url.searchParams.set('fs', `b:${boardCode}`);
  url.searchParams.set('fields', 'f12,f14,f2,f3,f9,f20,f62,f100');
  const rows = [];
  for (let page = 1; page <= 20; page += 1) {
    url.searchParams.set('pn', String(page));
    const payload = await fetchJson(url);
    const pageRows = payload.data?.diff ?? [];
    rows.push(...pageRows);
    if (pageRows.length < 100) break;
  }
  return rows.map((row) => ({
    code: String(row.f12),
    name: String(row.f14 ?? row.f12),
    price: toNullableNumber(row.f2),
    change: toNullableNumber(row.f3),
    capitalFlow: toNullableNumber(row.f62) === null ? null : Number((Number(row.f62) / 100000000).toFixed(2)),
    marketCap: toNullableNumber(row.f20),
    pe: toNullableNumber(row.f9),
    industry: String(row.f100 ?? '未分类'),
  }));
}

async function getMarketListPage(kind, page) {
  const url = new URL('https://push2delay.eastmoney.com/api/qt/clist/get');
  url.searchParams.set('pn', String(page));
  url.searchParams.set('pz', kind === 'industry' ? '100' : '24');
  url.searchParams.set('po', '1');
  url.searchParams.set('np', '1');
  url.searchParams.set('ut', 'bd1d9ddb04089700cf9c27f6f7426281');
  url.searchParams.set('fltt', '2');
  url.searchParams.set('invt', '2');
  url.searchParams.set('fid', kind === 'industry' ? 'f62' : 'f62');
  url.searchParams.set('fs', kind === 'industry' ? 'm:90+t:2' : 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23');
  url.searchParams.set('fields', kind === 'industry' ? 'f12,f14,f3,f62,f104,f128' : 'f12,f14,f2,f3,f62,f100');
  return fetchJson(url);
}

function toNullableNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function jsonResponse(payload, status = 200) {
  return withCors(
    new Response(JSON.stringify(payload), {
      status,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    }),
  );
}

function withCors(response) {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  return response;
}

async function readRequestJson(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function searchSecurities(query) {
  if (!query) {
    return [];
  }

  const url = new URL('https://searchapi.eastmoney.com/api/suggest/get');
  url.searchParams.set('input', query);
  url.searchParams.set('type', '14');
  url.searchParams.set('token', EASTMONEY_TOKEN);
  url.searchParams.set('count', '8');

  const payload = await fetchJson(url);
  const rows = payload.QuotationCodeTable?.Data ?? [];
  const securities = rows
    .filter((item) => item.Code && /^\d{6}$/.test(String(item.Code)))
    .map((item) => ({
      code: String(item.Code),
      name: String(item.Name ?? item.Code),
      industry: '公开搜索',
      exchange: getExchangeByCode(String(item.Code)),
    }));

  if (securities.length > 0) {
    return securities;
  }

  return /^\d{6}$/.test(query)
    ? [{ code: query, name: query, industry: '公开搜索', exchange: getExchangeByCode(query) }]
    : [];
}

async function getFilings(code, type) {
  const [security] = await searchSecurities(code).catch(() => []);
  const filings = await fetchCninfoFilings(code, security?.name);
  return filings
    .filter((filing) => type === 'all' || filing.type === type)
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate));
}

async function fetchCninfoFilings(code, securityName = '') {
  if (!/^\d{6}$/.test(code)) {
    return [];
  }

  const keywords = [...new Set([securityName, code].map((item) => String(item ?? '').trim()).filter(Boolean))];
  const results = [];

  for (const category of CNINFO_REPORT_CATEGORIES) {
    for (const keyword of keywords) {
      results.push(...(await fetchCninfoFilingPage(code, category, keyword)));
    }
  }

  return dedupeFilings(results);
}

async function fetchCninfoFilingPage(code, category, keyword) {
  const form = new URLSearchParams();
  form.set('stock', '');
  form.set('tabName', 'fulltext');
  form.set('pageSize', '30');
  form.set('pageNum', '1');
  form.set('column', getCninfoColumn(code));
  form.set('category', category);
  form.set('plate', '');
  form.set('seDate', '');
  form.set('searchkey', keyword);
  form.set('secid', '');
  form.set('sortName', '');
  form.set('sortType', '');
  form.set('isHLtitle', 'true');

  const response = await fetch('https://www.cninfo.com.cn/new/hisAnnouncement/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      Referer: 'https://www.cninfo.com.cn/new/commonUrl/pageOfSearch?url=disclosure/list/search',
      'User-Agent': 'Mozilla/5.0',
    },
    body: form.toString(),
  });

  if (!response.ok) {
    throw new Error(`巨潮公告接口请求失败：${response.status}`);
  }

  const payload = await response.json();
  return (payload.announcements ?? [])
    .filter((item) => String(item.secCode ?? '') === code)
    .map((item) => {
      const title = stripHtml(String(item.announcementTitle ?? item.shortTitle ?? ''));
      const type = normalizeFilingType(title);

      return {
        id: String(item.announcementId ?? `${code}-${item.announcementTime ?? title}`),
        title,
        type,
        reportDate: formatCninfoDate(item.announcementTime),
        source: 'cninfo',
        url: item.adjunctUrl ? `https://static.cninfo.com.cn/${item.adjunctUrl}` : `https://www.cninfo.com.cn/new/disclosure/stock?stockCode=${code}`,
      };
    })
    .filter((filing) => ['annual', 'interim', 'quarterly', 'earnings_preview'].includes(filing.type));
}

function dedupeFilings(filings) {
  const seen = new Set();
  const unique = [];

  for (const filing of filings) {
    const key = filing.id || `${filing.title}-${filing.reportDate}-${filing.url}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(filing);
  }

  return unique;
}

async function buildRealAnalysis(code, filingId) {
  const [security] = await searchSecurities(code);
  const filings = await getFilings(code, 'all');
  const filing = filings.find((item) => item.id === filingId) ?? filings[0];

  if (!security || !filing) {
    throw new Error('未找到真实证券或公告数据，无法生成分析');
  }

  const forecasts = await fetchEastmoneyForecasts(code).catch(() => []);
  const relatedForecast = pickRelatedForecast(forecasts, filing);
  const financeReports = await fetchEastmoneyMainFinance(code).catch(() => []);
  const relatedFinanceReport = pickRelatedFinanceReport(financeReports, filing);
  const componentScores = buildComponentScores(filing, forecasts, relatedForecast, relatedFinanceReport);
  const riskFlags = buildRiskFlags(componentScores, relatedForecast, relatedFinanceReport);
  const bullishDrivers = buildDrivers(componentScores, relatedForecast, relatedFinanceReport);
  const score = summarizeScore(componentScores);
  const scoreBreakdown = summarizeScoreBreakdown(componentScores, riskFlags);
  const verdict = deriveVerdict(score, riskFlags, relatedForecast, relatedFinanceReport);

  return {
    security,
    filing,
    verdict,
    score,
    expectationGap: buildExpectationGap(relatedForecast, relatedFinanceReport),
    bullishDrivers,
    riskFlags,
    componentScores,
    scoreBreakdown: { ...scoreBreakdown, finalScore: score },
    methodology: {
      engine: '规则引擎 v1（未接入 AI 模型）',
      rules: [
        '公告必须来自真实公开接口，不能用演示数据替代',
        '业绩预告只匹配同一披露年度的结构化记录',
        '缺少一致预期、环比增速或同年结构化预告时，不判定为超预期',
        '雷点按缺失项、业绩下滑、风险措辞和利润区间明确度触发',
      ],
      expectationStandard: '当前版本没有接入机构一致预期和完整季度环比财务表；因此“超预期”只在同年结构化预告明确、增速较高且无高风险雷点时给出，否则标记为待核验或分化。',
      aiPrompt: buildAiAnalysisPrompt(security, filing, score, componentScores, riskFlags, relatedForecast, relatedFinanceReport),
    },
    industryChecklist: buildIndustryChecklist(security.industry, filing.type),
    summary: buildSummary(security, filing, score, componentScores, riskFlags, relatedForecast, relatedFinanceReport),
  };
}

async function fetchEastmoneyForecasts(code) {
  const url = new URL('https://datacenter-web.eastmoney.com/api/data/v1/get');
  url.searchParams.set('reportName', 'RPT_PUBLIC_OP_NEWPREDICT');
  url.searchParams.set('columns', 'ALL');
  url.searchParams.set('filter', `(SECURITY_CODE="${code}")`);
  url.searchParams.set('pageNumber', '1');
  url.searchParams.set('pageSize', '100');

  const payload = await fetchJson(url);
  return payload.result?.data ?? [];
}

async function fetchEastmoneyMainFinance(code) {
  const url = new URL('https://datacenter-web.eastmoney.com/api/data/v1/get');
  url.searchParams.set('reportName', 'RPT_F10_FINANCE_MAINFINADATA');
  url.searchParams.set('columns', 'ALL');
  url.searchParams.set('filter', `(SECURITY_CODE="${code}")`);
  url.searchParams.set('pageNumber', '1');
  url.searchParams.set('pageSize', '100');

  const payload = await fetchJson(url);
  return payload.result?.data ?? [];
}

async function fetchEastmoneyBalanceSheets(code) {
  const url = new URL('https://datacenter-web.eastmoney.com/api/data/v1/get');
  url.searchParams.set('reportName', 'RPT_DMSK_FN_BALANCE');
  url.searchParams.set('columns', 'ALL');
  url.searchParams.set('filter', `(SECURITY_CODE="${code}")`);
  url.searchParams.set('pageNumber', '1');
  url.searchParams.set('pageSize', '100');

  const payload = await fetchJson(url);
  return payload.result?.data ?? [];
}

async function fetchEastmoneyCashflows(code) {
  const url = new URL('https://datacenter-web.eastmoney.com/api/data/v1/get');
  url.searchParams.set('reportName', 'RPT_DMSK_FN_CASHFLOW');
  url.searchParams.set('columns', 'ALL');
  url.searchParams.set('filter', `(SECURITY_CODE="${code}")`);
  url.searchParams.set('pageNumber', '1');
  url.searchParams.set('pageSize', '100');

  const payload = await fetchJson(url);
  return payload.result?.data ?? [];
}

async function getFinancialMetrics(code, options) {
  const [security] = await searchSecurities(code);
  if (!security) {
    throw new Error('未找到证券数据，无法加载财务指标');
  }

  const current = await buildFinancialMetricPayload(security, options.period);
  const peerSecurities = options.includePeers ? await findPeerSecurities(security.code, options.peerCount) : [];
  const peers = [];

  for (const peer of peerSecurities) {
    const peerPayload = await buildFinancialMetricPayload(peer, options.period).catch(() => null);
    if (peerPayload?.periods.length) {
      peers.push({
        security: peerPayload.security,
        series: peerPayload.series,
      });
    }
  }

  return {
    ...current,
    peers,
    industryBenchmark: buildIndustryBenchmark(current.periods, peers),
  };
}

async function buildFinancialMetricPayload(security, period) {
  const [mainRows, balanceRows, cashflowRows] = await Promise.all([
    fetchEastmoneyMainFinance(security.code),
    fetchEastmoneyBalanceSheets(security.code).catch(() => []),
    fetchEastmoneyCashflows(security.code).catch(() => []),
  ]);
  const rows = mergeFinancialRows(mainRows, balanceRows, cashflowRows)
    .filter((row) => matchesMetricPeriod(row, period))
    .sort((a, b) => String(a.REPORT_DATE ?? '').localeCompare(String(b.REPORT_DATE ?? '')));
  const periods = rows.map((row) => getFinancialPeriodLabel(row));

  return {
    security,
    metricCatalog: METRIC_CATALOG.map(({ source, valueField, yoyField, qoqField, ...metric }) => metric),
    periods,
    series: buildMetricSeries(rows),
  };
}

function mergeFinancialRows(mainRows, balanceRows, cashflowRows) {
  const rowsByDate = new Map();

  for (const row of [...mainRows, ...balanceRows, ...cashflowRows]) {
    const date = normalizeReportDate(row.REPORT_DATE ?? row.REPORTDATE);
    if (!date) continue;
    rowsByDate.set(date, { ...(rowsByDate.get(date) ?? {}), ...row, REPORT_DATE: date });
  }

  return [...rowsByDate.values()];
}

function buildMetricSeries(rows) {
  const series = Object.fromEntries(METRIC_CATALOG.map((metric) => [metric.id, []]));

  for (const metric of METRIC_CATALOG) {
    const points = rows.map((row) => ({
      period: getFinancialPeriodLabel(row),
      reportDate: normalizeReportDate(row.REPORT_DATE ?? row.REPORTDATE),
      value: toFiniteNumber(row[metric.valueField]),
      yoy: toFiniteNumber(metric.yoyField ? row[metric.yoyField] : null),
      qoq: toFiniteNumber(metric.qoqField ? row[metric.qoqField] : null),
    }));

    for (let index = 0; index < points.length; index += 1) {
      if (points[index].qoq === null && index > 0) {
        points[index].qoq = calculateChangePercent(points[index - 1].value, points[index].value);
      }
    }

    series[metric.id] = points;
  }

  return series;
}

function matchesMetricPeriod(row, period) {
  const label = `${row.REPORT_DATE_NAME ?? ''}${row.REPORT_TYPE ?? ''}${row.DATEMMDD ?? ''}`;
  const date = normalizeReportDate(row.REPORT_DATE ?? row.REPORTDATE);
  const isAnnual = /年报/.test(label) || /-12-31$/.test(date);
  return period === 'annual' ? isAnnual : !isAnnual;
}

async function findPeerSecurities(code, peerCount) {
  if (peerCount <= 0) {
    return [];
  }

  const payload = await fetchJson(PEER_LIST_URL);
  const rows = payload.data?.diff ?? [];
  const current = rows.find((row) => String(row.f12) === code);
  const industry = current?.f100;
  if (!industry) {
    return [];
  }

  const exactPeers = rows
    .filter((row) => row.f100 === industry && String(row.f12) !== code && /^\d{6}$/.test(String(row.f12)))
    .sort((a, b) => Number(b.f20 ?? 0) - Number(a.f20 ?? 0))
    .map((row) => mapPeerRow(row, industry));

  const boardPeers = exactPeers.length >= peerCount
    ? []
    : await fetchBoardPeerSecurities(industry, code).catch(() => []);

  return uniqueSecurities([...exactPeers, ...boardPeers])
    .filter((security) => security.code !== code)
    .slice(0, peerCount);
}

async function fetchBoardPeerSecurities(industry, code) {
  const boardCode = INDUSTRY_BOARD_FALLBACKS.find((item) => item.pattern.test(String(industry)))?.boardCode;
  if (!boardCode) {
    return [];
  }

  const url = new URL('https://push2.eastmoney.com/api/qt/clist/get');
  url.searchParams.set('pn', '1');
  url.searchParams.set('pz', '80');
  url.searchParams.set('po', '1');
  url.searchParams.set('np', '1');
  url.searchParams.set('ut', EASTMONEY_TOKEN);
  url.searchParams.set('fltt', '2');
  url.searchParams.set('invt', '2');
  url.searchParams.set('fid', 'f20');
  url.searchParams.set('fs', `b:${boardCode}`);
  url.searchParams.set('fields', 'f12,f14,f20,f100');

  const payload = await fetchJson(url);
  return (payload.data?.diff ?? [])
    .filter((row) => String(row.f12) !== code && /^\d{6}$/.test(String(row.f12)))
    .sort((a, b) => Number(b.f20 ?? 0) - Number(a.f20 ?? 0))
    .map((row) => mapPeerRow(row, String(row.f100 ?? industry)));
}

function mapPeerRow(row, fallbackIndustry) {
  return {
    code: String(row.f12),
    name: String(row.f14 ?? row.f12),
    industry: String(row.f100 ?? fallbackIndustry),
    exchange: getExchangeByCode(String(row.f12)),
  };
}

function uniqueSecurities(securities) {
  const seen = new Set();
  return securities.filter((security) => {
    if (seen.has(security.code)) {
      return false;
    }

    seen.add(security.code);
    return true;
  });
}

function buildIndustryBenchmark(periods, peers) {
  const benchmark = {};

  for (const metric of METRIC_CATALOG) {
    benchmark[metric.id] = periods.map((period) => {
      const values = peers
        .map((peer) => peer.series?.[metric.id]?.find((point) => point.period === period)?.value)
        .filter((value) => Number.isFinite(value));

      return {
        period,
        median: median(values),
        max: values.length ? Math.max(...values) : null,
        min: values.length ? Math.min(...values) : null,
      };
    });
  }

  return benchmark;
}

export function pickRelatedForecast(forecasts, filing) {
  if (forecasts.length === 0) {
    return null;
  }

  const targetDate = inferForecastReportDate(filing);
  const targetYear = filing.reportDate.slice(0, 4);
  const samePeriodForecasts = forecasts.filter((item) => String(item.REPORT_DATE ?? '').startsWith(targetDate));
  const sameYearForecasts = forecasts.filter((item) => String(item.REPORT_DATE ?? '').startsWith(targetYear));
  const candidates = samePeriodForecasts.length > 0 ? samePeriodForecasts : sameYearForecasts;

  return sortForecastCandidates(candidates)[0] ?? null;
}

export function pickRelatedFinanceReport(financeReports, filing) {
  if (financeReports.length === 0) {
    return null;
  }

  const targetDate = inferForecastReportDate(filing);
  const targetYear = filing.reportDate.slice(0, 4);
  const samePeriodReports = financeReports.filter((item) => String(item.REPORT_DATE ?? '').startsWith(targetDate));
  const sameYearReports = financeReports.filter((item) => String(item.REPORT_DATE ?? '').startsWith(targetYear));
  const candidates = samePeriodReports.length > 0 ? samePeriodReports : sameYearReports;

  return [...candidates].sort((a, b) => String(b.NOTICE_DATE ?? '').localeCompare(String(a.NOTICE_DATE ?? '')))[0] ?? null;
}

function inferForecastReportDate(filing) {
  const year = filing.reportDate.slice(0, 4);
  const title = String(filing.title ?? '');

  if (/一季|第一季|1-3月|一季度/.test(title)) return `${year}-03-31`;
  if (/半年度|半年度|半年|1-6月|中期/.test(title)) return `${year}-06-30`;
  if (/三季|第三季|前三季|1-9月/.test(title)) return `${year}-09-30`;
  if (/年度|年报|1-12月/.test(title)) return `${year}-12-31`;

  const month = Number(filing.reportDate.slice(5, 7));
  if (month <= 4) return `${year}-03-31`;
  if (month <= 8) return `${year}-06-30`;
  if (month <= 10) return `${year}-09-30`;
  return `${year}-12-31`;
}

function sortForecastCandidates(candidates) {
  return [...candidates].sort((a, b) => forecastPriority(b) - forecastPriority(a));
}

function forecastPriority(item) {
  const finance = String(item.PREDICT_FINANCE ?? item.PREDICT_CONTENT ?? '');
  const code = String(item.PREDICT_FINANCE_CODE ?? '');
  let priority = 0;

  if (code === '004' || /归属于上市公司股东的净利润/.test(finance)) priority += 30;
  if (code === '005' || /扣除非经常性损益后的净利润/.test(finance)) priority += 20;
  if (/净利润/.test(finance)) priority += 10;
  if (Number.isFinite(Number(item.PREDICT_AMT_LOWER)) || Number.isFinite(Number(item.PREDICT_AMT_UPPER))) priority += 4;
  if (Number.isFinite(Number(item.INCREASE_JZ))) priority += 2;
  if (String(item.IS_LATEST ?? '') === 'T') priority += 1;

  return priority;
}

function buildComponentScores(filing, forecasts, relatedForecast, financeReport) {
  const filingScore = filing.source === 'cninfo' ? 90 : 50;
  const sourceComponent = {
    id: 'filing-source',
    label: '公告来源可信度',
    score: Math.round(filingScore),
    status: 'positive',
    detail: '公告列表来自巨潮资讯公开公告接口。',
    data: [
      { label: '公告标题', value: filing.title, source: '巨潮资讯' },
      { label: '披露日期', value: filing.reportDate, source: '巨潮资讯' },
      { label: '文件链接', value: filing.url, source: '巨潮资讯' },
    ],
  };

  if (!relatedForecast && financeReport) {
    return buildFinanceComponentScores(sourceComponent, financeReport);
  }

  const forecastState = String(relatedForecast?.FORECAST_STATE ?? '');
  const increase = Number(relatedForecast?.INCREASE_JZ);
  const amountLow = relatedForecast?.PREDICT_AMT_LOWER;
  const amountHigh = relatedForecast?.PREDICT_AMT_UPPER;
  const hasForecast = Boolean(relatedForecast);
  const hasProfitAmount = Number.isFinite(Number(amountLow)) || Number.isFinite(Number(amountHigh));
  const growthScore = !hasForecast
    ? null
    : forecastState === 'reduction'
      ? 35
      : Number.isFinite(increase)
        ? Math.round(clamp(55 + increase / 3, 25, 95))
        : 60;
  const evidenceScore = hasForecast ? (hasProfitAmount ? 85 : 68) : null;
  const qualityScore = hasForecast && /亏|下滑|减少|不确定|风险/.test(String(relatedForecast?.CHANGE_REASON_EXPLAIN ?? relatedForecast?.PREDICT_CONTENT ?? ''))
    ? 42
    : hasForecast
      ? 66
      : null;

  return [
    {
      id: 'filing-source',
      label: '公告来源可信度',
      score: Math.round(filingScore),
      status: 'positive',
      detail: '公告列表来自巨潮资讯公开公告接口。',
      data: [
        { label: '公告标题', value: filing.title, source: '巨潮资讯' },
        { label: '披露日期', value: filing.reportDate, source: '巨潮资讯' },
        { label: '文件链接', value: filing.url, source: '巨潮资讯' },
      ],
    },
    {
      id: 'forecast-growth',
      label: '业绩预告增速',
      score: roundNullableScore(growthScore),
      status: scoreStatus(growthScore),
      detail: hasForecast ? '使用东方财富公开业绩预告字段计算。' : '未检索到公开业绩预告结构化数据。',
      data: hasForecast
        ? [
            { label: '预告类型', value: String(relatedForecast.PREDICT_TYPE ?? '-'), source: '东方财富业绩预告' },
            { label: '预告财务项', value: String(relatedForecast.PREDICT_FINANCE ?? '-'), source: '东方财富业绩预告' },
            { label: '同比增幅中值', value: formatNullablePercent(relatedForecast.INCREASE_JZ), source: '东方财富业绩预告' },
          ]
        : [{ label: '业绩预告', value: '未取得', source: '东方财富业绩预告' }],
    },
    {
      id: 'profit-range',
      label: '利润区间明确度',
      score: roundNullableScore(evidenceScore),
      status: scoreStatus(evidenceScore),
      detail: hasProfitAmount ? '公告/预告提供了金额区间，可用于量化判断。' : '未取得明确金额区间，只能做低置信度判断。',
      data: hasForecast
        ? [
            { label: '下限', value: formatMoney(amountLow), source: '东方财富业绩预告' },
            { label: '上限', value: formatMoney(amountHigh), source: '东方财富业绩预告' },
            { label: '预测中值', value: formatMoney(relatedForecast.FORECAST_JZ), source: '东方财富业绩预告' },
          ]
        : [{ label: '利润区间', value: '未取得', source: '东方财富业绩预告' }],
    },
    {
      id: 'risk-language',
      label: '风险措辞检查',
      score: roundNullableScore(qualityScore),
      status: scoreStatus(qualityScore),
      detail: hasForecast ? '从业绩预告原因说明中检查亏损、下滑、不确定等风险措辞。' : '缺少可检查的预告原因说明。',
      data: hasForecast
        ? [
            {
              label: '原因说明',
              value: truncate(String(relatedForecast.CHANGE_REASON_EXPLAIN ?? relatedForecast.PREDICT_CONTENT ?? '-'), 120),
              source: '东方财富业绩预告',
            },
          ]
        : [{ label: '原因说明', value: '未取得', source: '东方财富业绩预告' }],
    },
  ];
}

function buildFinanceComponentScores(sourceComponent, financeReport) {
  const revenueGrowth = toFiniteNumber(financeReport.TOTALOPERATEREVETZ);
  const profitGrowth = toFiniteNumber(financeReport.PARENTNETPROFITTZ);
  const deductedGrowth = toFiniteNumber(financeReport.KCFJCXSYJLRTZ);
  const revenueQoq = toFiniteNumber(financeReport.YYZSRGDHBZC);
  const profitQoq = toFiniteNumber(financeReport.NETPROFITRPHBZC);
  const grossMargin = toFiniteNumber(financeReport.XSMLL);
  const netMargin = toFiniteNumber(financeReport.XSJLL);
  const roe = toFiniteNumber(financeReport.ROEJQ);
  const cashRevenueRatio = toFiniteNumber(financeReport.JYXJLYYSR);
  const operatingCashPerShare = toFiniteNumber(financeReport.MGJYXJJE);

  const growthScore = averageFinite([
    scoreGrowth(revenueGrowth),
    scoreGrowth(profitGrowth),
    scoreGrowth(deductedGrowth),
    scoreGrowth(revenueQoq, 0.75),
    scoreGrowth(profitQoq, 0.75),
  ]);
  const marginScore = averageFinite([
    scoreLevel(grossMargin, 15, 35),
    scoreLevel(netMargin, 5, 18),
    scoreLevel(roe, 3, 10),
  ]);
  const cashScore = averageFinite([
    scoreLevel(cashRevenueRatio, 8, 25),
    scoreLevel(operatingCashPerShare, 0, 1),
  ]);

  return [
    sourceComponent,
    {
      id: 'financial-growth',
      label: '营收与利润增长',
      score: roundNullableScore(growthScore),
      status: scoreStatus(growthScore),
      detail: '使用东方财富正式财报结构化主财务指标表，比较同比与报告期环比。',
      data: [
        { label: '报告期', value: String(financeReport.REPORT_DATE_NAME ?? financeReport.REPORT_TYPE ?? '-'), source: '东方财富财务指标' },
        { label: '营业收入', value: formatMoney(financeReport.TOTALOPERATEREVE), source: '东方财富财务指标' },
        { label: '营收同比', value: formatNullablePercent(revenueGrowth), source: '东方财富财务指标' },
        { label: '营收环比', value: formatNullablePercent(revenueQoq), source: '东方财富财务指标' },
        { label: '归母净利润', value: formatMoney(financeReport.PARENTNETPROFIT), source: '东方财富财务指标' },
        { label: '归母净利润同比', value: formatNullablePercent(profitGrowth), source: '东方财富财务指标' },
        { label: '归母净利润环比', value: formatNullablePercent(profitQoq), source: '东方财富财务指标' },
      ],
    },
    {
      id: 'profit-quality',
      label: '利润质量',
      score: roundNullableScore(marginScore),
      status: scoreStatus(marginScore),
      detail: '结合扣非净利润、毛利率、净利率和 ROE 判断利润含金量。',
      data: [
        { label: '扣非净利润', value: formatMoney(financeReport.KCFJCXSYJLR), source: '东方财富财务指标' },
        { label: '扣非净利润同比', value: formatNullablePercent(deductedGrowth), source: '东方财富财务指标' },
        { label: '毛利率', value: formatNullablePercent(grossMargin), source: '东方财富财务指标' },
        { label: '净利率', value: formatNullablePercent(netMargin), source: '东方财富财务指标' },
        { label: 'ROE', value: formatNullablePercent(roe), source: '东方财富财务指标' },
      ],
    },
    {
      id: 'cashflow-quality',
      label: '现金流质量',
      score: roundNullableScore(cashScore),
      status: scoreStatus(cashScore),
      detail: '用经营现金流收入比和每股经营现金流检查利润是否有现金流支撑。',
      data: [
        { label: '经营现金流/收入', value: formatNullablePercent(cashRevenueRatio), source: '东方财富财务指标' },
        { label: '每股经营现金流', value: formatNullableNumber(operatingCashPerShare), source: '东方财富财务指标' },
      ],
    },
  ];
}

function buildRiskFlags(componentScores, forecast, financeReport) {
  const flags = [];
  const missing = componentScores.filter((item) => item.status === 'missing');

  if (missing.length > 0) {
    flags.push({
      id: 'missing-structured-data',
      label: '结构化财务数据缺失',
      severity: 'high',
      value: missing.map((item) => item.label).join('、'),
      benchmark: '缺少同年结构化预告、机构一致预期、季度环比或现金流字段时，不判定为超预期',
      source: '公开接口可用性检查',
    });
  }

  if (forecast?.FORECAST_STATE === 'reduction' || Number(forecast?.INCREASE_JZ) < 0) {
    flags.push({
      id: 'forecast-reduction',
      label: '业绩预告偏弱或下滑',
      severity: 'high',
      value: `同比增幅中值 ${formatNullablePercent(forecast?.INCREASE_JZ)}`,
      benchmark: '同比增幅中值小于 0% 视为高风险',
      source: '东方财富业绩预告',
    });
  }

  if (/亏|不确定|风险|减少|下滑/.test(String(forecast?.CHANGE_REASON_EXPLAIN ?? forecast?.PREDICT_CONTENT ?? ''))) {
    flags.push({
      id: 'risk-wording',
      label: '预告原因含风险措辞',
      severity: 'medium',
      value: truncate(String(forecast?.CHANGE_REASON_EXPLAIN ?? forecast?.PREDICT_CONTENT), 80),
      benchmark: '出现亏损、下滑、不确定、风险等措辞需复核公告原文',
      source: '东方财富业绩预告',
    });
  }

  if (financeReport && toFiniteNumber(financeReport.PARENTNETPROFITTZ) !== null && toFiniteNumber(financeReport.PARENTNETPROFITTZ) < 0) {
    flags.push({
      id: 'profit-decline',
      label: '归母净利润同比下滑',
      severity: 'high',
      value: `归母净利润同比 ${formatNullablePercent(financeReport.PARENTNETPROFITTZ)}`,
      benchmark: '正式财报归母净利润同比小于 0% 视为核心风险',
      source: '东方财富财务指标',
    });
  }

  if (financeReport && toFiniteNumber(financeReport.NETPROFITRPHBZC) !== null && toFiniteNumber(financeReport.NETPROFITRPHBZC) < 0) {
    flags.push({
      id: 'profit-qoq-decline',
      label: '归母净利润环比下滑',
      severity: 'medium',
      value: `归母净利润环比 ${formatNullablePercent(financeReport.NETPROFITRPHBZC)}`,
      benchmark: '报告期环比为负，说明本期动能走弱，需要结合季节性复核',
      source: '东方财富财务指标',
    });
  }

  return flags;
}

function buildDrivers(componentScores, forecast, financeReport) {
  const drivers = [];

  if (Number(financeReport?.PARENTNETPROFITTZ) > 20) {
    drivers.push(`归母净利润同比增长 ${formatNullablePercent(financeReport.PARENTNETPROFITTZ)}`);
  }

  if (Number(financeReport?.TOTALOPERATEREVETZ) > 10) {
    drivers.push(`营业收入同比增长 ${formatNullablePercent(financeReport.TOTALOPERATEREVETZ)}`);
  }

  if (Number(financeReport?.JYXJLYYSR) > 15) {
    drivers.push(`经营现金流/收入 ${formatNullablePercent(financeReport.JYXJLYYSR)}`);
  }

  if (Number(forecast?.INCREASE_JZ) > 30) {
    drivers.push(`业绩预告同比增幅中值 ${formatNullablePercent(forecast.INCREASE_JZ)}`);
  }

  if (Number.isFinite(Number(forecast?.FORECAST_JZ))) {
    drivers.push(`预告利润中值 ${formatMoney(forecast.FORECAST_JZ)}`);
  }

  if (componentScores[0]?.score >= 80) {
    drivers.push('公告来源来自巨潮资讯，可追溯到原始 PDF');
  }

  return drivers;
}

function summarizeScore(componentScores) {
  if (componentScores.length === 0) {
    return 0;
  }

  const score = componentScores.reduce((total, item) => total + (Number.isFinite(item.score) ? item.score : 35), 0) / componentScores.length;
  const missingCount = componentScores.filter((item) => item.status === 'missing').length;
  const missingPenalty = missingCount * 6;

  return Math.round(clamp(score - missingPenalty, 0, 100));
}

export function summarizeScoreBreakdown(componentScores, riskFlags) {
  const scored = componentScores.filter((item) => Number.isFinite(item.score));
  const componentAverage = scored.length
    ? Math.round(scored.reduce((total, item) => total + Number(item.score), 0) / scored.length)
    : 0;
  const missingCount = componentScores.filter((item) => item.status === 'missing').length;
  const missingPenalty = missingCount * 6;
  const highRiskPenalty = riskFlags.filter((flag) => flag.severity === 'high').length * 8;
  const finalScore = Math.round(clamp(componentAverage - missingPenalty - highRiskPenalty, 0, 100));

  return {
    formula: '综合评分 = 分项均值 - 缺失项惩罚 - 高风险惩罚',
    componentAverage,
    missingPenalty,
    highRiskPenalty,
    finalScore,
    rows: componentScores.map((item) => ({
      id: item.id,
      label: item.label,
      score: Number.isFinite(item.score) ? Math.round(Number(item.score)) : null,
      weight: scored.length ? Number((1 / scored.length).toFixed(2)) : 0,
      status: item.status,
      evidence: (item.data ?? []).map((data) => `${data.label}=${data.value}`).join('；') || item.detail || '未取得',
      rule: item.detail ?? '按公开结构化字段评分',
    })),
    waterfall: [
      { label: '分项均值', value: componentAverage },
      { label: '缺失项惩罚', value: -missingPenalty },
      { label: '高风险惩罚', value: -highRiskPenalty },
      { label: '综合评分', value: finalScore },
    ],
  };
}

function deriveVerdict(score, riskFlags, forecast, financeReport) {
  if (!forecast && !financeReport) {
    return 'mixed';
  }

  if (riskFlags.some((flag) => flag.severity === 'high')) {
    return 'below';
  }

  if (score >= 75 && (Number(forecast?.INCREASE_JZ) > 20 || Number(financeReport?.PARENTNETPROFITTZ) > 20)) {
    return 'above';
  }

  if (score < 55) {
    return 'below';
  }

  return riskFlags.length > 0 ? 'mixed' : 'in_line';
}

function buildExpectationGap(forecast, financeReport) {
  if (!forecast && financeReport) {
    return {
      basis: 'reported_financials',
      percent: toFiniteNumber(financeReport.PARENTNETPROFITTZ),
      label: `正式财报结构化指标：归母净利润同比 ${formatNullablePercent(financeReport.PARENTNETPROFITTZ)}，营收同比 ${formatNullablePercent(financeReport.TOTALOPERATEREVETZ)}，归母净利润环比 ${formatNullablePercent(financeReport.NETPROFITRPHBZC)}`,
    };
  }

  if (!forecast) {
    return {
      basis: 'historical_trend',
      percent: null,
      label: '未取得同年公开一致预期、季度环比或业绩预告结构化数据，不能判断为超预期',
    };
  }

  return {
    basis: 'guidance_range',
    percent: Number.isFinite(Number(forecast.INCREASE_JZ)) ? Number(Number(forecast.INCREASE_JZ).toFixed(2)) : null,
    label: `${forecast.PREDICT_FINANCE ?? '业绩预告'}：${forecast.PREDICT_TYPE ?? '-'}，同比增幅中值 ${formatNullablePercent(forecast.INCREASE_JZ)}`,
  };
}

function buildSummary(security, filing, score, componentScores, riskFlags, forecast, financeReport) {
  const missing = componentScores.filter((item) => item.status === 'missing').map((item) => item.label);
  const scoreText = `综合评分 ${score}，其中 ${componentScores.map((item) => `${item.label}${item.score === null ? '缺失' : `${item.score}分`}`).join('、')}`;
  const riskText = riskFlags.length > 0
    ? `主要雷点：${riskFlags.map((flag) => `${flag.label}（${flag.value ?? '需复核'}）`).join('；')}。`
    : '暂未识别高优先级雷点。';
  const missingText = missing.length > 0 ? `缺失项：${missing.join('、')}，不使用演示数据替代。` : '';
  const forecastText = forecast
    ? `业绩预告依据：${forecast.PREDICT_CONTENT ?? forecast.CHANGE_REASON_EXPLAIN ?? '-'}`
    : financeReport
      ? `正式财报依据：营收同比 ${formatNullablePercent(financeReport.TOTALOPERATEREVETZ)}，归母净利润同比 ${formatNullablePercent(financeReport.PARENTNETPROFITTZ)}，归母净利润环比 ${formatNullablePercent(financeReport.NETPROFITRPHBZC)}，经营现金流/收入 ${formatNullablePercent(financeReport.JYXJLYYSR)}。`
      : '未取得同年业绩预告结构化字段；缺少 Q2 环比、机构一致预期和完整财务表时，仅可做低置信度核验。';

  return `${security.name}${filing.title}：${scoreText}。${riskText}${missingText}${forecastText}`;
}

function buildAiAnalysisPrompt(security, filing, score, componentScores, riskFlags, forecast) {
  const componentText = componentScores
    .map((item) => {
      const dataText = item.data.map((data) => `${data.label}=${data.value}`).join('；');
      return `- ${item.label}：${item.score === null ? '数据缺失' : `${item.score}分`}；${item.detail}；${dataText}`;
    })
    .join('\n');
  const riskText = riskFlags.length > 0
    ? riskFlags.map((flag) => `- ${flag.label}：${flag.value ?? '待核验'}；阈值/规则：${flag.benchmark ?? '未设置'}`).join('\n')
    : '- 暂未识别高优先级风险';
  const forecastText = forecast
    ? JSON.stringify(
        {
          预告类型: forecast.PREDICT_TYPE,
          财务项目: forecast.PREDICT_FINANCE,
          下限: forecast.PREDICT_AMT_LOWER,
          上限: forecast.PREDICT_AMT_UPPER,
          中值: forecast.FORECAST_JZ,
          同比增幅中值: forecast.INCREASE_JZ,
          原因说明: forecast.CHANGE_REASON_EXPLAIN ?? forecast.PREDICT_CONTENT,
        },
        null,
        2,
      )
    : '未取得同报告期结构化业绩预告数据';

  return `你是一名A股财报和业绩预告分析师。请基于以下公开数据，判断该公告是超预期、符合预期、不及预期还是结果分化，并明确列出依据和雷点。不要编造未提供的数据；如果缺少机构一致预期、环比数据或现金流数据，请标注为待补充。

公司：${security.name}（${security.code}）
公告：${filing.title}
披露日期：${filing.reportDate}
公告链接：${filing.url}

当前规则引擎初评分：${score}

结构化业绩预告数据：
${forecastText}

分项评分：
${componentText}

风险雷点：
${riskText}

请按以下格式输出：
1. 一句话结论
2. 是否超预期及判断标准
3. 关键数据表格
4. 正向因素
5. 风险雷点
6. 还需要补充的数据
7. 如果我是投资者，下一步应该核验什么`;
}

function normalizeFilingType(title) {
  if (/业绩预告|业绩快报|业绩预增|业绩预减|盈利预告|业绩预披露|预披露/.test(title)) return 'earnings_preview';
  if (/半年度报告|半年报|中期报告/.test(title)) return 'interim';
  if (/季度报告|一季报|三季报|第三季度|第一季度/.test(title)) return 'quarterly';
  if (/年度报告|年报/.test(title)) return 'annual';
  return 'other';
}

function buildIndustryChecklist(industry, filingType) {
  if (filingType === 'earnings_preview') {
    return ['预告上下限是否足够明确', '预告原因是否可持续', '是否存在变脸或低基数效应', '后续定期报告是否兑现预告'];
  }

  if (/电力设备|汽车|机械|制造|电子|半导体|公开搜索/.test(industry)) {
    return ['毛利率是否改善', '存货和应收是否异常扩张', '经营现金流是否覆盖利润', '订单和产能利用是否支撑后续增长'];
  }

  return ['收入和利润增速是否匹配', '现金流是否支撑利润', '扣非利润是否可靠', '资产负债和营运资本是否异常'];
}

async function fetchJson(url, init) {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`公开数据接口请求失败：${response.status}`);
  }
  return response.json();
}

function getExchangeByCode(code) {
  if (/^[689]/.test(code)) return 'SSE';
  if (/^[023]/.test(code)) return 'SZSE';
  if (/^[48]/.test(code)) return 'BSE';
  return 'UNKNOWN';
}

function getCninfoColumn(code) {
  if (/^[689]/.test(code)) return 'sse';
  if (/^[48]/.test(code)) return 'bj';
  return 'szse';
}

function stripHtml(value) {
  return value.replace(/<[^>]+>/g, '');
}

function formatCninfoDate(value) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const date = new Date(Number(value));
  if (Number.isNaN(date.getTime())) {
    return String(value).slice(0, 10);
  }

  return date.toISOString().slice(0, 10);
}

function scoreStatus(score) {
  if (score === null) return 'missing';
  if (score >= 75) return 'positive';
  if (score < 55) return 'negative';
  return 'neutral';
}

function formatMoney(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return '未取得';
  if (Math.abs(number) >= 100000000) return `${(number / 100000000).toFixed(2)}亿元`;
  if (Math.abs(number) >= 10000) return `${(number / 10000).toFixed(2)}万元`;
  return `${number.toFixed(2)}元`;
}

function formatNullablePercent(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `${number >= 0 ? '+' : ''}${number.toFixed(2)}%` : '未取得';
}

function normalizeReportDate(value) {
  if (!value) return '';
  return String(value).slice(0, 10);
}

function getFinancialPeriodLabel(row) {
  if (row.REPORT_DATE_NAME) return String(row.REPORT_DATE_NAME);
  if (row.DATATYPE) return String(row.DATATYPE);
  const date = normalizeReportDate(row.REPORT_DATE ?? row.REPORTDATE);
  const year = date.slice(0, 4);
  if (date.endsWith('-03-31')) return `${year}一季报`;
  if (date.endsWith('-06-30')) return `${year}中报`;
  if (date.endsWith('-09-30')) return `${year}三季报`;
  if (date.endsWith('-12-31')) return `${year}年报`;
  return date || '未披露';
}

function formatNullableNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(2) : '未取得';
}

function toFiniteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function averageFinite(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) {
    return null;
  }
  return finite.reduce((total, value) => total + value, 0) / finite.length;
}

function scoreGrowth(value, weight = 1) {
  if (!Number.isFinite(value)) {
    return null;
  }
  return clamp(55 + value * weight, 20, 95);
}

function scoreLevel(value, weak, strong) {
  if (!Number.isFinite(value)) {
    return null;
  }
  if (strong === weak) {
    return 60;
  }
  return clamp(35 + ((value - weak) / (strong - weak)) * 55, 20, 95);
}

function calculateChangePercent(previous, current) {
  if (!Number.isFinite(previous) || !Number.isFinite(current) || Number(previous) === 0) {
    return null;
  }
  return Number((((Number(current) - Number(previous)) / Math.abs(Number(previous))) * 100).toFixed(2));
}

function median(values) {
  if (!values.length) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

function truncate(value, maxLength) {
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundNullableScore(score) {
  return Number.isFinite(score) ? Math.round(score) : null;
}

export { normalizeFilingType };
