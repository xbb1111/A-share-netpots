# A-share-netpots

个人 A 股投研工作台，用于行业分析、候选股票池观察和预警信息展示。

## 功能

- 深色金融终端风格界面
- 接入东方财富公开实时行情，展示 A 股行业强弱、涨跌幅和主力资金流
- 按实时行情派生候选股票池评分、标签和预警信号
- 市场日历、关注主题和策略备忘展示真实数据口径与复核提醒
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

之后重新运行 GitHub Pages workflow，线上页面会用该地址调用财报检索和分析接口。
