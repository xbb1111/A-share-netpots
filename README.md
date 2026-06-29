# A-share-netpots

个人 A 股投研工作台基础版，用于行业分析、候选股票池观察和预警信息展示。

## 功能

- 深色金融终端风格界面
- A 股行业强弱与资金热度展示
- 候选股票池评分、标签和投资逻辑
- 预警中心、市场日历、关注主题和策略备忘
- 模拟数据层，后续可替换为真实行情或后台服务

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
