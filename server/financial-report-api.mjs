import http from 'node:http';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.FINANCIAL_REPORT_API_PORT ?? 8787);
const EASTMONEY_TOKEN = 'D43BF722C8E33A6';

const server = http.createServer(async (request, response) => {
  try {
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');

    if (request.method === 'OPTIONS') {
      response.writeHead(204);
      response.end();
      return;
    }

    const url = new URL(request.url ?? '/', `http://${request.headers.host}`);

    if (request.method === 'GET' && url.pathname === '/') {
      sendJson(response, {
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
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/securities/search') {
      const query = (url.searchParams.get('q') ?? '').trim();
      sendJson(response, { securities: await searchSecurities(query) });
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/filings') {
      const code = (url.searchParams.get('code') ?? '').trim();
      const type = url.searchParams.get('type') ?? 'all';
      const filings = await getFilings(code, type);
      sendJson(response, { filings });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/filings/analyze') {
      const body = await readJson(request);
      const code = String(body.code ?? '').trim();
      const filingId = String(body.filingId ?? '').trim();
      const analysis = await buildRealAnalysis(code, filingId);
      sendJson(response, { analysis });
      return;
    }

    sendJson(response, { message: 'Not found' }, 404);
  } catch (error) {
    sendJson(response, { message: error instanceof Error ? error.message : 'Unknown API error' }, 500);
  }
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  server.listen(PORT, () => {
    console.log(`Financial report API listening on http://localhost:${PORT}`);
  });
}

function sendJson(response, payload, status = 200) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(payload));
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on('error', reject);
  });
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
  const filings = await fetchCninfoFilings(code);
  return filings
    .filter((filing) => type === 'all' || filing.type === type)
    .sort((a, b) => b.reportDate.localeCompare(a.reportDate));
}

async function fetchCninfoFilings(code) {
  if (!/^\d{6}$/.test(code)) {
    return [];
  }

  const form = new URLSearchParams();
  form.set('stock', '');
  form.set('tabName', 'fulltext');
  form.set('pageSize', '50');
  form.set('pageNum', '1');
  form.set('column', getCninfoColumn(code));
  form.set('category', '');
  form.set('plate', '');
  form.set('seDate', '');
  form.set('searchkey', code);
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

async function buildRealAnalysis(code, filingId) {
  const [security] = await searchSecurities(code);
  const filings = await getFilings(code, 'all');
  const filing = filings.find((item) => item.id === filingId) ?? filings[0];

  if (!security || !filing) {
    throw new Error('未找到真实证券或公告数据，无法生成分析');
  }

  const forecasts = await fetchEastmoneyForecasts(code).catch(() => []);
  const relatedForecast = pickRelatedForecast(forecasts, filing);
  const componentScores = buildComponentScores(filing, forecasts, relatedForecast);
  const riskFlags = buildRiskFlags(componentScores, relatedForecast);
  const bullishDrivers = buildDrivers(componentScores, relatedForecast);
  const score = summarizeScore(componentScores);
  const verdict = deriveVerdict(score, riskFlags, relatedForecast);

  return {
    security,
    filing,
    verdict,
    score,
    expectationGap: buildExpectationGap(relatedForecast),
    bullishDrivers,
    riskFlags,
    componentScores,
    methodology: {
      engine: '规则引擎 v1（未接入 AI 模型）',
      rules: [
        '公告必须来自真实公开接口，不能用演示数据替代',
        '业绩预告只匹配同一披露年度的结构化记录',
        '缺少一致预期、环比增速或同年结构化预告时，不判定为超预期',
        '雷点按缺失项、业绩下滑、风险措辞和利润区间明确度触发',
      ],
      expectationStandard: '当前版本没有接入机构一致预期和完整季度环比财务表；因此“超预期”只在同年结构化预告明确、增速较高且无高风险雷点时给出，否则标记为待核验或分化。',
    },
    industryChecklist: buildIndustryChecklist(security.industry, filing.type),
    summary: buildSummary(security, filing, score, componentScores, riskFlags, relatedForecast),
  };
}

async function fetchEastmoneyForecasts(code) {
  const url = new URL('https://datacenter-web.eastmoney.com/api/data/v1/get');
  url.searchParams.set('reportName', 'RPT_PUBLIC_OP_NEWPREDICT');
  url.searchParams.set('columns', 'ALL');
  url.searchParams.set('filter', `(SECURITY_CODE="${code}")`);
  url.searchParams.set('pageNumber', '1');
  url.searchParams.set('pageSize', '20');

  const payload = await fetchJson(url);
  return payload.result?.data ?? [];
}

export function pickRelatedForecast(forecasts, filing) {
  if (forecasts.length === 0) {
    return null;
  }

  const profitForecasts = forecasts.filter((item) => /净利润/.test(String(item.PREDICT_FINANCE ?? item.PREDICT_CONTENT ?? '')));
  const targetYear = filing.reportDate.slice(0, 4);
  const sameYearForecast =
    profitForecasts.find((item) => String(item.REPORT_DATE ?? '').startsWith(targetYear)) ??
    forecasts.find((item) => String(item.REPORT_DATE ?? '').startsWith(targetYear));

  return sameYearForecast ?? null;
}

function buildComponentScores(filing, forecasts, relatedForecast) {
  const filingScore = filing.source === 'cninfo' ? 90 : 50;
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

function buildRiskFlags(componentScores, forecast) {
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

  return flags;
}

function buildDrivers(componentScores, forecast) {
  const drivers = [];

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

function deriveVerdict(score, riskFlags, forecast) {
  if (!forecast) {
    return 'mixed';
  }

  if (riskFlags.some((flag) => flag.severity === 'high')) {
    return 'below';
  }

  if (score >= 75 && Number(forecast?.INCREASE_JZ) > 20) {
    return 'above';
  }

  if (score < 55) {
    return 'below';
  }

  return riskFlags.length > 0 ? 'mixed' : 'in_line';
}

function buildExpectationGap(forecast) {
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

function buildSummary(security, filing, score, componentScores, riskFlags, forecast) {
  const missing = componentScores.filter((item) => item.status === 'missing').map((item) => item.label);
  const scoreText = `综合评分 ${score}，其中 ${componentScores.map((item) => `${item.label}${item.score === null ? '缺失' : `${item.score}分`}`).join('、')}`;
  const riskText = riskFlags.length > 0
    ? `主要雷点：${riskFlags.map((flag) => `${flag.label}（${flag.value ?? '需复核'}）`).join('；')}。`
    : '暂未识别高优先级雷点。';
  const missingText = missing.length > 0 ? `缺失项：${missing.join('、')}，不使用演示数据替代。` : '';
  const forecastText = forecast ? `业绩预告依据：${forecast.PREDICT_CONTENT ?? forecast.CHANGE_REASON_EXPLAIN ?? '-'}` : '未取得同年业绩预告结构化字段；缺少 Q2 环比、机构一致预期和完整财务表时，仅可做低置信度核验。';

  return `${security.name}${filing.title}：${scoreText}。${riskText}${missingText}${forecastText}`;
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
