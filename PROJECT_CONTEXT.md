# A-share-netpots 项目上下文

> **给未来的 Codex 或开发者：在修改本项目之前，先完整阅读本文件。** 本文件是跨电脑、跨任务恢复项目上下文的首要入口；具体设计细节以 `docs/superpowers/specs/` 和 `docs/superpowers/plans/` 中的文件为准。

## 文档状态

- 最后核对日期：2026-07-20（Asia/Shanghai）
- 仓库：`xbb1111/A-share-netpots`
- 本机原始目录：`D:\a-share-center`
- 默认分支：`main`
- 文档依据：当前受版本控制的源码和配置、Git 提交历史、已有设计/实施文档，以及项目所有者关于换电脑继续开发的要求。
- 本文件不保存密码、访问令牌、私钥或其他秘密值。

## 项目定位

这是一个个人 A 股投研工作台，面向行业研究、产业链梳理、自定义指数观察、候选股票池分析、预警信息展示、财报检索与行情研究。界面采用深色金融终端风格，数据主要来自公开市场接口，并通过本项目的统一 API 层访问。

项目目前不是单纯的静态展示页面。它由静态 React 前端、可在本地运行的 Node API，以及线上使用的 Cloudflare Worker API 共同组成。

## 技术栈

- React 19 + TypeScript
- Vite 7
- Vitest
- Recharts
- Lucide React
- Node.js API 适配器
- Cloudflare Workers
- GitHub Actions + GitHub Pages

`package-lock.json` 已纳入版本控制；新电脑应优先使用 `npm install` 或 CI 中的 `npm ci` 恢复依赖，不应依赖从旧电脑复制的 `node_modules`。

## 架构与数据流

```text
浏览器中的 React/Vite 前端
        |
        | /api/*
        v
本地开发：Vite 代理 -> http://localhost:8787 -> server/financial-report-api.mjs
线上部署：GitHub Pages -> Cloudflare Worker -> server/financial-report-api.mjs
        |
        v
东方财富、腾讯行情、巨潮资讯等公开数据源
```

主要边界：

- `src/`：前端页面、组件、领域计算、浏览器存储和数据服务。
- `server/financial-report-api.mjs`：本地 Node 与 Worker 共用的请求处理和第三方数据适配逻辑。
- `server/financial-report-node.mjs`：本地 HTTP 服务入口，默认监听 `8787`。
- `server/financial-report-worker.mjs`：Cloudflare Worker 入口。
- `vite.config.ts`：本地开发服务器将 `/api` 转发至 `http://localhost:8787`。
- `wrangler.toml`：Worker 名称为 `a-share-financial-report-api`，入口为 `server/financial-report-worker.mjs`。
- `.github/workflows/pages.yml`：推送到 `main` 后构建并部署 GitHub Pages。

## 本地接口与线上接口的准确区别

### 本地开发

前端请求使用相对路径 `/api/...`。Vite 根据 `vite.config.ts` 把它代理到：

```text
http://localhost:8787
```

因此本地完整运行通常需要两个终端：

```powershell
npm run api
```

```powershell
npm run dev
```

只启动 `npm run dev` 时，页面可以打开，但依赖 `/api` 的财报、行情和行业功能可能不可用。

### GitHub Pages 线上部署

GitHub Pages 只能托管静态前端，不能直接运行 Node API。线上构建通过仓库变量 `FINANCIAL_REPORT_API_BASE` 注入环境变量 `VITE_FINANCIAL_REPORT_API_BASE`，前端据此调用独立部署的 Cloudflare Worker。

如果构建时没有注入该变量，当前源码在 GitHub Pages 主机名下会回退到仓库内写明的 Worker 地址：

```text
https://a-share-financial-report-api.2561340168.workers.dev
```

这个回退地址属于部署配置的一部分，可能随 Worker 迁移而变化。修改 Worker 地址时，必须同时检查：

- GitHub 仓库变量 `FINANCIAL_REPORT_API_BASE`
- `src/data/financialReportService.ts` 中的回退地址
- README 和本文件中的部署说明

## 主要功能

### 市场与股票研究

- 从公开行情接口构建市场概览、行业强弱、资金流、候选股票池、预警、交易日历和关注主题。
- 对数据端点设置容错；部分行情源失效时尽可能保留仍可取得的数据。
- K 线请求包含备用数据源逻辑，近期提交专门修复了 K 线与证券行情指标的回退能力。

### 行业研究工作台

- 行业目录、产业链上下游、公司列表和实时指标联动。
- 行业市场图采用分组的非网格“星群/气泡”布局，视觉编码用于表达涨跌、规模和重点程度。
- 行业数据不完整时允许局部结果继续显示，而不是整页失败。

### 自定义产业链画布

- 支持递归产业链节点、画布持久化、分享载荷和脑图布局。
- 支持添加子节点、同级节点、删除节点、改名、填写说明和管理节点股票。
- 节点编辑器直接嵌入画布，支持路径导航、指标刷新和边界校验。
- 缩放、拖动、布局和重复节点 ID 等情况有专门的保护与测试。

### 行业分支到自定义指数

- 可从某个产业链分支收集股票并生成临时指数 K 线预览。
- 支持等权和市值加权；当市值数据不足时限制不可用的计算方式。
- 临时预览与已保存指数分离，退出、保存、路由交接和异常载荷有独立校验。
- 自定义指数支持成分、权重、行情历史、基准比较以及浏览器本地保存。

### 财报研究

- 支持证券搜索、公告/财报检索、财报分析和财务指标读取。
- API 层访问巨潮资讯及公开市场数据源，前端统一通过 `financialReportService.ts` 生成请求地址。

## 重要文件与目录

- `src/App.tsx`：主应用及主要工作台/工具箱页面编排。
- `src/components/IndustriesPage.tsx`：行业研究主页面。
- `src/components/IndustryMarketMap.tsx`：行业星群市场图。
- `src/components/IndustryCanvasEditor.tsx`：产业链画布工作区。
- `src/components/IndustryCanvasMindMap.tsx`：产业链脑图展示。
- `src/components/IndustryCanvasNodeEditor.tsx`：画布节点内联编辑器。
- `src/components/FinancialReportPanel.tsx`：财报研究界面。
- `src/data/financialReportService.ts`：本地/线上 API 基址选择和财报请求。
- `src/data/marketService.ts`：市场工作台数据组装与容错。
- `src/data/industryService.ts`：行业板块和成分数据访问。
- `src/data/industryCanvas*.ts`：产业链模型、存储、分享与相关逻辑。
- `src/data/customIndex*.ts`：自定义指数计算、行情、预览状态和存储。
- `src/data/toolboxRoute.ts`：工具箱与临时预览的路由状态。
- `server/financial-report-api.mjs`：共享 API 实现。
- `server/financial-report-api.test.mjs`：API 端点测试。
- `docs/superpowers/specs/`：已批准的设计决策。
- `docs/superpowers/plans/`：对应实施计划和文件级改动说明。

## 已确认的项目记忆与设计决策

以下内容由现有规格、计划和 Git 历史重建，不依赖旧聊天窗口：

1. 2026-07-10 的行业研究工作台设计确立了行业目录、产业链、公司表格及行情联动的基础结构。
2. 2026-07-11 扩展为行业研究画布：递归节点、本地持久化、分享格式、气泡图、分支预览和工具箱交接成为正式能力。
3. 随后的自定义产业链脑图与市场图工作进一步确立了确定性非网格布局、递归脑图和以检查器/画布为中心的编辑方式。
4. 2026-07-14 的行业体验重设计明确了三条主线：分组行业星群、行业标签直达自定义指数 K 线、画布内原位编辑。
5. 临时指数预览必须与已保存指数隔离；预览载荷需要校验，退出和保存后路由状态必须保持一致。
6. 画布编辑必须保持模型不变量，包括递归节点唯一性、有效选择、极端缩放连续性和删除节点后的合理回退。
7. 行情和第三方公开接口可能部分失败，因此数据服务采用超时、局部降级和备用 K 线/行情来源，而不是假设单一接口始终稳定。
8. 本地开发和线上部署故意使用不同的 API 承载方式；这不是两套源码，而是同一套前端针对不同运行环境选择不同 API 地址。

建议未来接手者先阅读这些文件：

- `docs/superpowers/specs/2026-07-10-industry-research-workbench-design.md`
- `docs/superpowers/specs/2026-07-11-industry-research-canvas-design.md`
- `docs/superpowers/specs/2026-07-14-industry-market-map-index-handoff-canvas-editing-design.md`
- 与上述文件同日期或同主题的 `docs/superpowers/plans/` 实施计划

## 当前已验证状态

截至 2026-07-20：

- `main` 已包含依赖锁文件刷新、K 线备用数据源、证券行情指标回退、行业工作流重设计及画布稳定性修复。
- 创建本文档前，在隔离工作区运行 `npm test`：23 个测试文件、187 项测试通过。
- 在此前提交依赖锁文件时运行过完整测试和生产构建，当时 82 个测试文件、611 项测试通过，`npm run build` 成功。测试数量随后会随依赖安装状态和仓库内容变化，未来应以当次实际运行结果为准。
- 本文件记录的是仓库可验证状态，不保证第三方公开接口、Cloudflare Worker 或 GitHub Pages 在任意时刻都在线。

## 安装与本地开发

建议安装 Node.js 24，与 GitHub Actions 使用的版本保持一致。

```powershell
git clone https://github.com/xbb1111/A-share-netpots.git
cd A-share-netpots
npm install
```

启动本地 API：

```powershell
npm run api
```

另开终端启动前端：

```powershell
npm run dev
```

常用命令：

```powershell
npm test
npm run build
npm run preview
npm run worker:dev
npm run worker:deploy
```

## GitHub Pages 与 Cloudflare Worker 部署

### GitHub Pages

- 推送到 `main` 会触发 `.github/workflows/pages.yml`。
- 工作流使用 Node.js 24、`npm ci` 和 `npm run build`。
- 构建产物 `dist/` 会被发布到 GitHub Pages。
- `dist/` 是生成物并被 `.gitignore` 忽略，不需要手工提交。

### Cloudflare Worker

Worker 部署命令：

```powershell
npm run worker:deploy
```

新电脑需要重新登录 Wrangler/Cloudflare，或者在自动化环境中重新配置以下秘密：

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`

GitHub 仓库还需要维护变量：

- `FINANCIAL_REPORT_API_BASE`

这里只记录名称，不应把实际令牌值写入本文件或提交到 Git。

## Git 克隆和复制文件夹分别会带走什么

### 从 GitHub 克隆

会恢复：

- 已提交并已推送的源码、测试、文档和配置。
- Git 提交历史和远程仓库关系。

不会自动恢复：

- 未提交或尚未推送的改动。
- `.env`、`.env.*`、`*.local` 等被忽略文件。
- `node_modules`、`dist` 和本机日志。
- GitHub、Cloudflare、Wrangler 的登录状态或令牌。
- 浏览器 `localStorage` 中保存的自定义画布、自定义指数和其他本地状态。
- 部署平台后台的秘密值、变量值或历史部署状态。

### 直接复制整个项目文件夹

如果连隐藏的 `.git` 一起完整复制，可以保留当前分支、提交历史、远程配置和未提交文件，也更可能保留 `.env` 或 `*.local` 等本机文件。

但仍不会自动复制：

- 浏览器个人资料中的 `localStorage` 数据。
- Windows 凭据管理器、GitHub 登录、SSH 私钥和 Cloudflare 登录状态，除非另行迁移相应账户配置。
- 远程 GitHub/Cloudflare 平台自身的数据。

不建议依赖复制过来的 `node_modules`；换电脑后应删除或忽略旧依赖目录并重新运行 `npm install`。

## 换电脑恢复检查清单

1. 在旧电脑运行 `git status --short --branch`，确认没有遗漏的未提交文件。
2. 运行测试与构建：`npm test`、`npm run build`。
3. 提交需要保留的改动，并执行 `git push origin main`。
4. 额外完整复制项目文件夹作为本地备份，务必包含隐藏的 `.git`。
5. 单独安全备份被忽略的 `.env`、`*.local` 或其他本机配置；不要把秘密上传到公开仓库。
6. 如果需要保留自定义画布或自定义指数，必须从旧浏览器导出/迁移对应站点的浏览器数据；仅复制仓库不包含这些数据。
7. 新电脑安装 Git、Node.js 24 和需要的开发工具。
8. 从 GitHub 克隆，或使用完整复制的文件夹。
9. 运行 `npm install`、`npm test` 和 `npm run build`。
10. 分别启动 `npm run api` 与 `npm run dev`，验证本地 `/api` 链路。
11. 重新完成 GitHub 与 Cloudflare/Wrangler 登录。
12. 检查 GitHub 仓库变量 `FINANCIAL_REPORT_API_BASE` 和 Cloudflare Worker 是否仍可访问。
13. 在新的 Codex 任务中先要求读取 `PROJECT_CONTEXT.md`，再继续开发。

## 已知限制与下一步

- 项目依赖多个第三方公开数据源，它们可能限流、调整字段、临时不可用或改变跨域策略。接口故障应先区分前端、统一 API 层和上游数据源。
- GitHub Pages 是静态托管，不能替代 Node/Worker API。
- 浏览器本地保存的数据没有纳入 Git；跨电脑迁移需要单独的导出/导入方案。目前仓库中尚未确认存在统一的浏览器数据导出入口。
- 当前没有由项目所有者确认的下一项功能优先级。开始新功能前，应先确认目标，再查阅相关规格和测试，避免破坏现有行业画布与指数预览流程。
- 建议下一项迁移增强是为自定义画布和自定义指数提供明确的导出/导入能力；在所有者确认之前，这只是建议，不是已批准任务。

## 本文档维护规则

发生以下变化时，应在同一提交或紧随其后的文档提交中更新本文件：

- 本地或线上 API 地址选择逻辑变化。
- GitHub Actions、Cloudflare Worker、环境变量或秘密名称变化。
- 新增重要功能、页面、数据存储或外部服务。
- 重要设计决策、已知限制或下一步优先级变化。
- 换电脑恢复流程发生变化。

每次更新都应修改“最后核对日期”。不要记录秘密值，不要把未经验证的聊天印象写成既定事实；新的详细设计继续放在 `docs/superpowers/specs/`，本文件只保留便于快速接手的稳定摘要。
