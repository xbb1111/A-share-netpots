# Industry Research Workbench Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the A-share industry page from a 12-row momentum list into a searchable industry panorama and an upstream/midstream/downstream research workbench with real board constituents.

**Architecture:** Keep live vendor requests behind focused data services, normalize them into app-owned types, and keep the curated supply-chain taxonomy in a versioned local module. Render the feature from a dedicated `IndustriesPage` component so the already-large `App.tsx` only wires data and navigation.

**Tech Stack:** React 19, TypeScript 5.9, Vite 7, Vitest 4, Recharts, Eastmoney public quote endpoints.

---

### Task 1: Define the industry and supply-chain domain model

**Files:**
- Create: `src/data/industryTaxonomy.ts`
- Create: `src/data/industryTaxonomy.test.ts`
- Modify: `src/data/types.ts`

- [ ] **Step 1: Write the failing taxonomy test**

```ts
import { describe, expect, it } from 'vitest';
import { INDUSTRY_CHAINS, findChainNode } from './industryTaxonomy';

describe('industry taxonomy', () => {
  it('models the complete new-energy vehicle chain in stage order', () => {
    const chain = INDUSTRY_CHAINS.find((item) => item.id === 'new-energy-vehicle');
    expect(chain?.stages.map((stage) => stage.id)).toEqual(['upstream', 'midstream', 'downstream']);
    expect(chain?.stages.every((stage) => stage.nodes.length > 0)).toBe(true);
    expect(findChainNode('new-energy-vehicle', 'power-battery')?.matchKeywords).toContain('动力电池');
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/data/industryTaxonomy.test.ts`

Expected: FAIL because `industryTaxonomy.ts` does not exist.

- [ ] **Step 3: Add app-owned types and the versioned chain data**

Add these interfaces to `src/data/types.ts`:

```ts
export type IndustryStageId = 'upstream' | 'midstream' | 'downstream';
export type IndustryChainNode = { id: string; name: string; description: string; matchKeywords: string[]; boardCodes?: string[] };
export type IndustryChainStage = { id: IndustryStageId; name: string; nodes: IndustryChainNode[] };
export type IndustryChain = { id: string; name: string; summary: string; stages: IndustryChainStage[] };
export type IndustryBoard = IndustrySignal & { code: string; level: 1 | 2 | 3; parentCode?: string };
export type IndustryCompany = { code: string; name: string; price: number | null; change: number | null; capitalFlow: number | null; marketCap: number | null; industry: string };
```

Create `INDUSTRY_CHAINS` with a `new-energy-vehicle` entry whose nodes include lithium resources, nickel/cobalt, rare earths, cathode/anode materials, separators/electrolyte, power batteries, motors, electronic control, thermal management, auto parts, complete vehicles, charging/swapping, and mobility/aftermarket. Export `findChainNode(chainId, nodeId)` as a pure lookup.

- [ ] **Step 4: Run the taxonomy test and verify GREEN**

Run: `npm test -- src/data/industryTaxonomy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the isolated domain model**

```powershell
git add src/data/types.ts src/data/industryTaxonomy.ts src/data/industryTaxonomy.test.ts
git commit -m "feat: add industry supply chain taxonomy"
```

### Task 2: Add complete board and constituent data services

**Files:**
- Create: `src/data/industryService.ts`
- Create: `src/data/industryService.test.ts`
- Modify: `src/data/marketService.ts`
- Modify: `src/data/marketService.test.ts`

- [ ] **Step 1: Write failing service tests**

```ts
import { describe, expect, it } from 'vitest';
import { fetchIndustryBoards, fetchIndustryCompanies } from './industryService';

it('normalizes all returned boards and keeps board codes', async () => {
  const fetcher = async () => ({ ok: true, json: async () => ({ data: { diff: [
    { f12: 'BK0475', f14: '银行', f3: 1.2, f62: 300000000, f104: 42, f128: '招商银行' },
  ] } }) });
  await expect(fetchIndustryBoards(fetcher)).resolves.toMatchObject([{ code: 'BK0475', name: '银行', capitalFlow: 3 }]);
});

it('loads and normalizes companies for one board', async () => {
  const fetcher = async (url: string) => ({ ok: true, json: async () => ({ data: { diff: [
    { f12: '300750', f14: '宁德时代', f2: 218.6, f3: 2.41, f62: 920000000, f20: 987000000000, f100: '电池' },
  ] } }) });
  const rows = await fetchIndustryCompanies('BK1030', fetcher);
  expect(rows[0]).toMatchObject({ code: '300750', name: '宁德时代', marketCap: 987000000000 });
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- src/data/industryService.test.ts src/data/marketService.test.ts`

Expected: FAIL because the service exports do not exist and the current sector URL still requests only 12 rows.

- [ ] **Step 3: Implement normalized requests and caching**

Implement `fetchIndustryBoards(fetcher = fetch)` using the existing industry endpoint with `pz=500`, retaining `f12` as `code`. Implement `fetchIndustryCompanies(boardCode, fetcher = fetch)` using `fs=b:${boardCode}` and fields `f12,f14,f2,f3,f20,f62,f100`. Convert money flow to hundred-million yuan, preserve `null` for unavailable values, throw a user-safe error on non-OK responses, and cache successful constituent promises by board code. Export `clearIndustryCompanyCache()` for deterministic tests.

Update `getDashboardData()` to use `fetchIndustryBoards()` rather than its private fixed-12 sector loader while preserving the current `DashboardData.industries` contract for overview consumers.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/data/industryService.test.ts src/data/marketService.test.ts`

Expected: PASS, including an assertion that the board request URL contains `pz=500`.

- [ ] **Step 5: Commit the service layer**

```powershell
git add src/data/industryService.ts src/data/industryService.test.ts src/data/marketService.ts src/data/marketService.test.ts
git commit -m "feat: load complete industry boards and constituents"
```

### Task 3: Build the industry workbench component

**Files:**
- Create: `src/components/IndustriesPage.tsx`
- Create: `src/components/IndustriesPage.test.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing pure interaction tests**

Export pure helpers from the component module and test them without adding a DOM test dependency:

```ts
import { describe, expect, it } from 'vitest';
import { filterIndustryItems, sortIndustryCompanies } from './IndustriesPage';

it('finds industries, chain nodes, and companies by one query', () => {
  const result = filterIndustryItems('电池', boards, chains, companies);
  expect(result.map((item) => item.kind)).toEqual(['industry', 'chain-node', 'company']);
});

it('sorts missing company values after numeric values', () => {
  expect(sortIndustryCompanies(companies, 'change', 'desc').at(-1)?.change).toBeNull();
});
```

- [ ] **Step 2: Run the tests and verify RED**

Run: `npm test -- src/components/IndustriesPage.test.tsx`

Expected: FAIL because the page module and helpers do not exist.

- [ ] **Step 3: Implement the three-view workbench**

Create an `IndustriesPage` accepting `{ industries: IndustrySignal[] }`. It must:

- render tabs `今日行情`, `行业全景`, and `产业链主题`;
- keep the momentum ranking in the first tab without mixing hierarchy labels;
- show a searchable board directory and lazy-load a selected board's companies in the second tab;
- default the third tab to `new-energy-vehicle`, render its three stages left-to-right, and resolve selected nodes to matching live boards before loading companies;
- expose explicit loading, empty, partial-data, and retry states;
- synchronize `industryView`, `industry`, `chain`, and `node` in `URLSearchParams` after the hash route, and restore them on mount;
- sort companies by change, flow, and market cap with missing values last.

Replace the old inline `IndustriesPage` in `src/App.tsx` with the component import and pass `data.industries`. Do not modify custom-index code while resolving conflicts.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run: `npm test -- src/components/IndustriesPage.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the component**

```powershell
git add src/components/IndustriesPage.tsx src/components/IndustriesPage.test.tsx src/App.tsx
git commit -m "feat: add industry research workbench"
```

### Task 4: Apply the financial-terminal layout and responsive behavior

**Files:**
- Modify: `src/styles.css`
- Modify: `src/colorSemantics.test.ts`

- [ ] **Step 1: Add a failing style-contract test**

Extend `src/colorSemantics.test.ts` to read `styles.css` and assert that `.industry-workbench`, `.industry-directory`, `.industry-chain`, `.industry-company-table`, and the existing red-up/green-down variables are present.

- [ ] **Step 2: Run the test and verify RED**

Run: `npm test -- src/colorSemantics.test.ts`

Expected: FAIL because the new workbench selectors do not exist.

- [ ] **Step 3: Implement the approved layout**

Style a compact header and tab bar, a `280px / minmax(0, 1fr)` directory-detail grid, horizontal three-stage chain cards, dense company rows, active/hover/focus states, and skeleton/error/empty panels. At `max-width: 900px`, switch the directory-detail grid and chain to one column; at `max-width: 640px`, hide nonessential company columns while keeping company name, code, and change visible. Reuse existing gold accents and red-up/green-down semantics.

- [ ] **Step 4: Run style and production checks**

Run: `npm test -- src/colorSemantics.test.ts`

Expected: PASS.

Run: `npm run build`

Expected: TypeScript and Vite build succeed without errors.

- [ ] **Step 5: Commit the layout**

```powershell
git add src/styles.css src/colorSemantics.test.ts
git commit -m "style: redesign industry research page"
```

### Task 5: Verify behavior against the approved design

**Files:**
- Modify only if a failing verification exposes a defect in files from Tasks 1-4.

- [ ] **Step 1: Run the entire automated suite**

Run: `npm test`

Expected: all tests pass, including existing overview, custom-index, price-discipline, and financial-report tests.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: exit code 0 and a generated `dist` bundle.

- [ ] **Step 3: Perform browser acceptance checks**

At `http://127.0.0.1:5174/#industries`, verify:

1. 今日行情 shows the complete normalized board list and retains real-time indicators.
2. 行业全景 selection loads real companies and a failed request provides Retry.
3. 产业链主题 opens 新能源汽车 and shows upstream, midstream, and downstream nodes.
4. Selecting 动力电池 shows matching boards and companies such as the live API returns; no static company is invented.
5. Reload restores the selected view/node from the URL.
6. Desktop and narrow viewport layouts have no horizontal page overflow.

- [ ] **Step 4: Inspect scope and repository status**

Run: `git status --short` and `git diff --stat HEAD~4..HEAD`.

Expected: only industry feature files are included in feature commits; the user's pre-existing `src/data/customIndex.test.ts` change remains untouched.

- [ ] **Step 5: Request final code review**

Use `superpowers:requesting-code-review`, address any high-confidence findings, rerun `npm test` and `npm run build`, then prepare the final handoff.
