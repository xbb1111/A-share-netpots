# A-share-netpots

个人 A 股投研工作台，用于行业分析、候选股票池观察和预警信息展示。

## 功能

- 深色金融终端风格界面
- 接入东方财富公开实时行情，展示 A 股行业强弱、涨跌幅和主力资金流
- 按实时行情派生候选股票池评分、标签和预警信号
- 市场日历、关注主题和策略备忘展示真实数据口径与复核提醒
- 工具箱内置“情绪指标”：六项指标独立展示、252 日情绪分位与 20–252 个交易日全局缩放
- 工具箱内置“大资金动向”：核心宽基 ETF 净申购代理与中金所 IF/IH/IC/IM 前 20 会员席位披露
- 支持手动刷新行情数据

## 本地运行

```bash
npm install
npm run dev
```

## 构建

```bash
npm run build
```

## 部署

仓库包含 GitHub Pages workflow。推送到 `main` 分支后，GitHub Actions 会自动构建并发布 `dist`。

## 线上财报分析 API

GitHub Pages 只能托管静态前端，财报分析需要单独部署 API。仓库已提供 Cloudflare Workers 入口：

```bash
npm run worker:deploy
```

部署前需要在 Cloudflare 登录 Wrangler，或在 GitHub 仓库 Secrets 中配置：

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

Worker 发布后，把 Worker 地址写入 GitHub 仓库变量 `FINANCIAL_REPORT_API_BASE`，例如：

```text
https://a-share-financial-report-api.<你的 workers.dev 子域>.workers.dev
```

之后重新运行 GitHub Pages workflow，线上页面会用该地址调用财报检索、分析和情绪指标接口。

情绪指标采用公开数据代理口径。Worker workflow 会在工作日北京时间 07:30 重新生成最近 252 个交易日的统一快照并发布；页面中的“手动刷新”用于立即获取线上最新快照。

“大资金动向”使用上交所、深交所公开 ETF 份额、公开基金净值与中金所成交持仓排名。ETF 净申购按“份额变化 × 单位净值”估算，不能直接认定为国家队交易；期指会员排名属于期货公司经纪业务席位汇总，不代表期货公司自营仓位。ETF 数据模型与拆分识别方法参考 MIT 许可的 [yushiguang/etf_dashboard](https://github.com/yushiguang/etf_dashboard)，本项目已按现有 Node/Worker 架构重新实现。
