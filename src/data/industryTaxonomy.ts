import type { IndustryChain, IndustryChainNode } from './types';

export const INDUSTRY_CHAINS: IndustryChain[] = [
  {
    id: 'new-energy-vehicle',
    name: '新能源汽车',
    summary: '从资源、材料和核心零部件，到整车、补能与后市场的完整产业链。',
    stages: [
      {
        id: 'upstream',
        name: '上游 · 资源与基础材料',
        nodes: [
          { id: 'lithium-resource', name: '锂资源', description: '锂矿、盐湖提锂及锂盐加工。', matchKeywords: ['锂矿', '盐湖提锂', '锂'] },
          { id: 'nickel-cobalt', name: '镍钴资源', description: '动力电池所需镍、钴资源及冶炼。', matchKeywords: ['镍', '钴', '小金属'] },
          { id: 'rare-earth', name: '稀土永磁', description: '驱动电机所需稀土与永磁材料。', matchKeywords: ['稀土', '磁性材料', '稀土永磁'] },
          { id: 'battery-raw-material', name: '电池基础材料', description: '铜箔、铝箔、石墨等电池基础材料。', matchKeywords: ['铜箔', '铝箔', '石墨', '电池材料'] },
        ],
      },
      {
        id: 'midstream',
        name: '中游 · 核心制造',
        nodes: [
          { id: 'cathode-anode', name: '正负极材料', description: '正极、负极及前驱体材料。', matchKeywords: ['正极材料', '负极材料', '电池材料'] },
          { id: 'separator-electrolyte', name: '隔膜与电解液', description: '锂电隔膜、电解液与添加剂。', matchKeywords: ['隔膜', '电解液', '氟化工'] },
          { id: 'power-battery', name: '动力电池', description: '电芯、模组、PACK 与电池回收。', matchKeywords: ['动力电池', '电池', '锂电池', '电池回收'] },
          { id: 'motor-control', name: '电机电控', description: '驱动电机、电控系统与功率器件。', matchKeywords: ['电机', '电控', '功率半导体', 'IGBT'] },
          { id: 'thermal-management', name: '热管理', description: '热泵空调、冷却系统及相关零部件。', matchKeywords: ['热管理', '汽车热管理', '制冷'] },
          { id: 'auto-parts', name: '汽车零部件', description: '底盘、车身、智能座舱及其他关键零部件。', matchKeywords: ['汽车零部件', '智能座舱', '线控底盘'] },
        ],
      },
      {
        id: 'downstream',
        name: '下游 · 应用与服务',
        nodes: [
          { id: 'complete-vehicle', name: '新能源整车', description: '乘用车、商用车与整车代工。', matchKeywords: ['新能源汽车', '乘用车', '商用车', '汽车整车'] },
          { id: 'charging-swapping', name: '充换电', description: '充电桩、充电运营和换电网络。', matchKeywords: ['充电桩', '换电', '充电运营'] },
          { id: 'mobility-service', name: '运营与后市场', description: '出行运营、汽车服务与动力电池梯次利用。', matchKeywords: ['网约车', '汽车服务', '电池回收', '汽车后市场'] },
        ],
      },
    ],
  },
  {
    id: 'ai-compute', name: 'AI 算力', summary: '从芯片、服务器与数据中心，到模型和应用服务。',
    stages: [
      { id: 'upstream', name: '上游 · 芯片与设备', nodes: [
        { id: 'ai-chip', name: 'AI 芯片', description: 'GPU、ASIC 与先进封装。', matchKeywords: ['半导体', '芯片', '集成电路'] },
        { id: 'optical', name: '光模块', description: '高速光通信器件与模块。', matchKeywords: ['光模块', '通信设备', '光通信'] },
      ] },
      { id: 'midstream', name: '中游 · 算力基础设施', nodes: [
        { id: 'server', name: '服务器', description: 'AI 服务器、液冷与 IDC。', matchKeywords: ['服务器', '液冷', '数据中心', 'IDC'] },
        { id: 'cloud', name: '云计算', description: '公有云、算力租赁与云服务。', matchKeywords: ['云计算', '算力租赁', '软件开发'] },
      ] },
      { id: 'downstream', name: '下游 · 模型与应用', nodes: [
        { id: 'model', name: '大模型', description: '模型训练、推理与平台服务。', matchKeywords: ['大模型', '人工智能', 'AI'] },
        { id: 'application', name: 'AI 应用', description: '办公、营销、教育与行业应用。', matchKeywords: ['软件开发', '计算机应用', '人工智能'] },
      ] },
    ],
  },
  {
    id: 'semiconductor', name: '半导体', summary: '覆盖设计、制造、封测与设备材料的芯片产业链。',
    stages: [
      { id: 'upstream', name: '上游 · 设备与材料', nodes: [
        { id: 'semi-equipment', name: '半导体设备', description: '刻蚀、薄膜、清洗与检测设备。', matchKeywords: ['半导体设备', '芯片设备'] },
        { id: 'semi-material', name: '半导体材料', description: '硅片、光刻胶与电子化学品。', matchKeywords: ['半导体材料', '电子化学品', '光刻胶'] },
      ] },
      { id: 'midstream', name: '中游 · 制造与封测', nodes: [
        { id: 'foundry', name: '晶圆制造', description: '晶圆代工与特色工艺。', matchKeywords: ['半导体', '集成电路'] },
        { id: 'packaging', name: '封装测试', description: '先进封装与芯片测试。', matchKeywords: ['封装测试', '半导体'] },
      ] },
      { id: 'downstream', name: '下游 · 芯片设计', nodes: [
        { id: 'chip-design', name: '芯片设计', description: '存储、模拟、数字与专用芯片。', matchKeywords: ['芯片设计', '集成电路'] },
        { id: 'power-device', name: '功率器件', description: 'IGBT、SiC 与功率半导体。', matchKeywords: ['功率半导体', 'IGBT', '第三代半导体'] },
      ] },
    ],
  },
  {
    id: 'robotics', name: '机器人', summary: '从核心零部件、整机制造，到工业与服务场景。',
    stages: [
      { id: 'upstream', name: '上游 · 核心部件', nodes: [
        { id: 'servo', name: '伺服系统', description: '伺服电机、驱动器与控制器。', matchKeywords: ['机器人', '电机', '自动化设备'] },
        { id: 'reducer', name: '精密减速器', description: '谐波、RV 与精密传动。', matchKeywords: ['减速器', '机器人'] },
      ] },
      { id: 'midstream', name: '中游 · 整机与系统', nodes: [
        { id: 'industrial-robot', name: '工业机器人', description: '焊接、搬运与装配机器人。', matchKeywords: ['工业机器人', '机器人'] },
        { id: 'automation', name: '工业自动化', description: 'PLC、工控与智能制造系统。', matchKeywords: ['工业自动化', '自动化设备'] },
      ] },
      { id: 'downstream', name: '下游 · 应用场景', nodes: [
        { id: 'smart-factory', name: '智能工厂', description: '汽车、电子与新能源工厂自动化。', matchKeywords: ['智能制造', '工业互联网'] },
        { id: 'service-robot', name: '服务机器人', description: '物流、清洁与家庭服务机器人。', matchKeywords: ['服务机器人', '机器人'] },
      ] },
    ],
  },
  {
    id: 'photovoltaic', name: '光伏', summary: '从硅料硅片、电池组件，到电站与储能应用。',
    stages: [
      { id: 'upstream', name: '上游 · 硅料与设备', nodes: [
        { id: 'polysilicon', name: '硅料硅片', description: '多晶硅、单晶硅片与辅材。', matchKeywords: ['硅料', '硅片', '光伏'] },
        { id: 'pv-equipment', name: '光伏设备', description: '拉晶、切片与电池片设备。', matchKeywords: ['光伏设备', '电池片'] },
      ] },
      { id: 'midstream', name: '中游 · 电池与组件', nodes: [
        { id: 'pv-cell', name: '光伏电池', description: 'TOPCon、HJT 与钙钛矿电池。', matchKeywords: ['光伏电池', '光伏电池组件'] },
        { id: 'pv-module', name: '光伏组件', description: '组件、逆变器与支架。', matchKeywords: ['光伏组件', '逆变器', '光伏'] },
      ] },
      { id: 'downstream', name: '下游 · 电站与储能', nodes: [
        { id: 'pv-station', name: '光伏电站', description: '集中式与分布式光伏电站。', matchKeywords: ['电力', '光伏'] },
        { id: 'energy-storage', name: '储能', description: '电化学储能与电网侧应用。', matchKeywords: ['储能', '储能电池'] },
      ] },
    ],
  },
  {
    id: 'innovative-drug', name: '创新药', summary: '覆盖原料、研发外包、药物研发与商业化。',
    stages: [
      { id: 'upstream', name: '上游 · 原料与服务', nodes: [
        { id: 'cmo-cro', name: 'CRO / CMO', description: '研发外包、临床服务与生产外包。', matchKeywords: ['CRO', 'CMO', '医疗服务'] },
        { id: 'medical-equipment', name: '医药设备', description: '实验室、耗材与制药设备。', matchKeywords: ['医疗器械', '医药商业'] },
      ] },
      { id: 'midstream', name: '中游 · 药物研发', nodes: [
        { id: 'biologic', name: '生物药', description: '抗体、疫苗与细胞治疗。', matchKeywords: ['生物制品', '疫苗', '医疗服务'] },
        { id: 'chemical-drug', name: '化学制药', description: '小分子创新药与制剂。', matchKeywords: ['化学制药', '创新药'] },
      ] },
      { id: 'downstream', name: '下游 · 商业化', nodes: [
        { id: 'hospital', name: '医疗服务', description: '医院、诊断与专业服务。', matchKeywords: ['医疗服务', '医疗器械'] },
        { id: 'pharma-retail', name: '医药商业', description: '流通、零售与院外市场。', matchKeywords: ['医药商业', '医药生物'] },
      ] },
    ],
  },
];

export function findChainNode(chainId: string, nodeId: string): IndustryChainNode | undefined {
  return INDUSTRY_CHAINS.find((chain) => chain.id === chainId)?.stages
    .flatMap((stage) => stage.nodes)
    .find((node) => node.id === nodeId);
}

export function getChainBoardMatches<T extends { name: string; code: string }>(
  chainId: string,
  nodeId: string,
  boards: T[],
): T[] {
  const node = findChainNode(chainId, nodeId);
  if (!node) return [];

  return boards.filter((board) =>
    node.boardCodes?.includes(board.code)
    || node.matchKeywords.some((keyword) => board.name === keyword || (keyword.length >= 3 && board.name.includes(keyword))),
  );
}
