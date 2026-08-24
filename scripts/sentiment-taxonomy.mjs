const LEVEL_ONE_GROUPS = {
  农林牧渔: ['种植业', '渔业', '林业Ⅱ', '饲料', '农产品加工', '农业综合Ⅱ', '养殖业', '动物保健Ⅱ'],
  基础化工: ['化学原料', '化学制品', '化学纤维', '塑料', '橡胶', '农化制品', '非金属材料Ⅱ'],
  钢铁: ['普钢', '特钢Ⅱ', '冶钢原料'],
  有色金属: ['工业金属', '贵金属', '小金属', '能源金属', '金属新材料'],
  电子: ['半导体', '元件', '光学光电子', '消费电子', '其他电子Ⅱ', '电子化学品Ⅱ'],
  家用电器: ['白色家电', '黑色家电', '小家电', '厨卫电器', '家电零部件Ⅱ', '照明设备Ⅱ', '其他家电Ⅱ'],
  食品饮料: ['白酒Ⅱ', '非白酒', '饮料乳品', '休闲食品', '食品加工', '调味发酵品Ⅱ'],
  纺织服饰: ['纺织制造', '服装家纺', '饰品'],
  轻工制造: ['造纸', '包装印刷', '家居用品', '文娱用品'],
  医药生物: ['化学制药', '中药Ⅱ', '生物制品', '医药商业', '医疗器械', '医疗服务'],
  公用事业: ['电力', '燃气Ⅱ'],
  交通运输: ['航运港口', '航空机场', '铁路公路', '物流'],
  房地产: ['房地产开发', '房地产服务'],
  商贸零售: ['一般零售', '专业连锁Ⅱ', '互联网电商', '贸易Ⅱ', '旅游零售Ⅱ'],
  社会服务: ['酒店餐饮', '旅游及景区', '教育', '专业服务', '体育Ⅱ'],
  综合: ['综合Ⅱ'],
  建筑材料: ['水泥', '玻璃玻纤', '装修建材'],
  建筑装饰: ['房屋建设Ⅱ', '基础建设', '专业工程', '装修装饰Ⅱ', '工程咨询服务Ⅱ'],
  电力设备: ['电池', '光伏设备', '风电设备', '电网设备', '电机Ⅱ', '其他电源设备Ⅱ'],
  国防军工: ['航海装备Ⅱ', '航空装备Ⅱ', '航天装备Ⅱ', '地面兵装Ⅱ', '军工电子Ⅱ'],
  计算机: ['计算机设备', '软件开发', 'IT服务Ⅱ'],
  传媒: ['数字媒体', '广告营销', '出版', '电视广播Ⅱ', '影视院线', '游戏Ⅱ'],
  通信: ['通信服务', '通信设备'],
  银行: ['银行Ⅱ'],
  非银金融: ['证券Ⅱ', '保险Ⅱ', '多元金融'],
  汽车: ['汽车零部件', '乘用车', '商用车', '汽车服务', '摩托车及其他'],
  机械设备: ['通用设备', '专用设备', '工程机械', '自动化设备', '轨交设备Ⅱ'],
  煤炭: ['煤炭开采', '焦炭Ⅱ'],
  石油石化: ['油气开采Ⅱ', '油服工程', '炼化及贸易'],
  环保: ['环境治理', '环保设备Ⅱ'],
  美容护理: ['个护用品', '化妆品', '医疗美容'],
};

export const SECOND_TO_FIRST_LEVEL = new Map(
  Object.entries(LEVEL_ONE_GROUPS).flatMap(([levelOne, levelTwoNames]) => levelTwoNames.map((levelTwo) => [levelTwo, levelOne])),
);

const NON_TOPICAL_THEME = /(融资融券|沪股通|深股通|富时|MSCI|标准普尔|HS300|上证|深成|深证100|中证|沪深|创业板综|创业成份|大盘股|中盘股|小盘股|大盘成长|中盘成长|小盘成长|权重股|百元股|风格|热股|高市净率|低市净率|高市盈率|低市盈率|中报|年报|季报|预增|预减|预盈|预亏|机构重仓|基金重仓|社保重仓|QFII|养老金|证金持股|转债标的|次新股|昨日|ST股|注册制|北交所|AH股|AB股|含H股|股权激励|价值股|高股息|央国企改革|参股银行|参股保险)/i;

export function toLevelOneIndustry(levelTwo) {
  return SECOND_TO_FIRST_LEVEL.get(String(levelTwo ?? '').trim()) ?? null;
}

export function getIndustryMappingProfile(levelTwoNames) {
  const normalized = levelTwoNames.map((name) => String(name ?? '').trim());
  const missing = normalized.filter((name) => !name || name === '-').length;
  const unmapped = [...new Set(normalized.filter((name) => name && name !== '-' && !SECOND_TO_FIRST_LEVEL.has(name)))].sort();
  const mapped = normalized.filter((name) => SECOND_TO_FIRST_LEVEL.has(name)).length;
  return {
    total: normalized.length,
    mapped,
    missing,
    coverage: normalized.length ? mapped / normalized.length : 0,
    unmapped,
  };
}

export function selectTopicalThemes(rows, limit = 3) {
  return rows
    .filter((row) => row && typeof row.name === 'string' && !NON_TOPICAL_THEME.test(row.name) && Number.isFinite(row.amount) && row.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .slice(0, limit)
    .map((row) => ({ name: row.name, amountYi: round(row.amount / 100_000_000, 2) }));
}

export function chinaDateFromUnix(seconds) {
  if (!Number.isFinite(seconds)) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(seconds * 1000));
}

function round(value, digits) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
