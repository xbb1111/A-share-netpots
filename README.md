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
