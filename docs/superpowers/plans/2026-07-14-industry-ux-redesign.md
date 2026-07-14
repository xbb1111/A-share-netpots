# Industry UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the loose industry bubble field with a grouped market constellation, route every industry preview to the correct temporary custom-index K-line, and move all custom-chain editing into expandable canvas nodes.

**Architecture:** Keep layout, preview handoff, persistence, and UI responsibilities separate. Pure data modules compute deterministic group layouts and temporary index requests; React components render the market map and in-canvas editor; `App.tsx` only coordinates routes and tool state. Temporary previews use `sessionStorage` and become permanent only through the existing custom-index save action.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Lucide React, existing custom-index and industry data services, CSS.

---

## File map

- Create `src/data/industryMarketMap.ts`: deterministic group/constellation layout and visual encoding.
- Create `src/data/industryMarketMap.test.ts`: layout determinism, grouping, bounds, and metric tests.
- Create `src/components/IndustryMarketMap.tsx`: grouped market-map rendering and keyboard interaction.
- Create `src/data/industryIndexPreview.ts`: recursive company collection, temporary index construction, session storage, and toolbox route creation.
- Create `src/data/industryIndexPreview.test.ts`: deduplication, transient storage, and route tests.
- Create `src/components/IndustryCanvasNodeEditor.tsx`: expanded node form rendered inside the canvas.
- Modify `src/components/IndustriesPage.tsx`: integrate market map, unified preview requests, and canvas callbacks.
- Modify `src/components/IndustriesPage.test.tsx`: preview request and route-helper coverage.
- Modify `src/data/canvasMindMap.ts`: variable node dimensions for the expanded editor.
- Modify `src/data/canvasMindMap.test.ts`: expanded-node spacing and bounds tests.
- Modify `src/components/IndustryCanvasMindMap.tsx`: HTML canvas nodes, inline editor, pan/zoom, and keyboard navigation.
- Modify `src/components/IndustryCanvasEditor.tsx`: remove the fixed inspector and provide canvas-level save/share/load controls.
- Modify `src/data/industryCanvas.ts`: add node description, sibling creation, stock removal, and node lookup helpers.
- Modify `src/data/industryCanvas.test.ts`: immutable node-editing tests.
- Modify `src/data/customIndexStorage.ts`: promote a temporary preview into permanent storage without duplicates.
- Modify `src/data/customIndexStorage.test.ts`: preview promotion tests.
- Modify `src/App.tsx`: hash-reactive toolbox state and automatic custom-index preview selection/calculation.
- Modify `src/styles.css`: grouped market map and in-canvas editor styling.

### Task 1: Deterministic grouped market constellation

**Files:**
- Create: `src/data/industryMarketMap.ts`
- Create: `src/data/industryMarketMap.test.ts`
- Create: `src/components/IndustryMarketMap.tsx`
- Modify: `src/components/IndustriesPage.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write failing layout tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildIndustryMarketMap } from './industryMarketMap';

const boards = [
  { code: 'BK1', name: '电子', level: 1, parent: '科技成长', heat: 90, change: -3.1 },
  { code: 'BK2', name: '通信', level: 1, parent: '科技成长', heat: 60, change: 0.8 },
  { code: 'BK3', name: '国防军工', level: 1, parent: '高端制造', heat: 95, change: 3.4 },
];

describe('industry market constellation', () => {
  it('is deterministic, grouped, bounded, and metric-driven', () => {
    const first = buildIndustryMarketMap(boards, 'heat', 960, 520);
    expect(first).toEqual(buildIndustryMarketMap(boards, 'heat', 960, 520));
    expect(first.groups.map((group) => group.label)).toEqual(['科技成长', '高端制造']);
    expect(first.items.every((item) => item.x >= 0 && item.y >= 0)).toBe(true);
    expect(first.items.find((item) => item.code === 'BK3')!.area)
      .toBeGreaterThan(first.items.find((item) => item.code === 'BK2')!.area);
    expect(first.items.find((item) => item.code === 'BK1')!.tone).toBe('down');
  });
});
```

- [ ] **Step 2: Run the test and verify red**

Run: `npm test -- --run src/data/industryMarketMap.test.ts`

Expected: FAIL because `industryMarketMap.ts` does not exist.

- [ ] **Step 3: Implement the pure grouped layout**

```ts
export type MarketMapMetric = 'heat' | 'change';
export type MarketMapInput = { code: string; name: string; parent?: string; heat: number; change: number };
export type MarketMapItem = { code: string; group: string; x: number; y: number; width: number; height: number; area: number; tone: 'up' | 'down' | 'flat' };
export type MarketMapGroup = { id: string; label: string; x: number; y: number; width: number; height: number };

export function buildIndustryMarketMap(items: MarketMapInput[], metric: MarketMapMetric, width: number, height: number) {
  const labels = [...new Set(items.map((item) => item.parent || '其他'))];
  const columns = Math.max(1, Math.ceil(Math.sqrt(labels.length * width / height)));
  const rows = Math.ceil(labels.length / columns);
  const gap = 16;
  const groupWidth = (width - gap * (columns + 1)) / columns;
  const groupHeight = (height - gap * (rows + 1)) / rows;
  const groups = labels.map((label, index) => ({ id: label, label, x: gap + index % columns * (groupWidth + gap), y: gap + Math.floor(index / columns) * (groupHeight + gap), width: groupWidth, height: groupHeight }));
  const max = Math.max(1, ...items.map((item) => metric === 'heat' ? Math.max(0, item.heat) : Math.abs(item.change)));
  const mapped: MarketMapItem[] = [];
  groups.forEach((group) => {
    const members = items.filter((item) => (item.parent || '其他') === group.label).sort((a, b) => b[metric] - a[metric] || a.code.localeCompare(b.code));
    const cellWidth = Math.max(72, (group.width - 24) / Math.max(1, Math.ceil(Math.sqrt(members.length))));
    members.forEach((item, index) => {
      const value = metric === 'heat' ? Math.max(0, item.heat) : Math.abs(item.change);
      const scale = .58 + .42 * Math.sqrt(value / max);
      mapped.push({ code: item.code, group: group.id, x: group.x + 12 + index % Math.ceil(Math.sqrt(members.length)) * cellWidth, y: group.y + 34 + Math.floor(index / Math.ceil(Math.sqrt(members.length))) * 76, width: cellWidth * scale, height: 62 * scale, area: value, tone: item.change > 0 ? 'up' : item.change < 0 ? 'down' : 'flat' });
    });
  });
  return { groups, items: mapped, width, height };
}
```

Use the existing taxonomy to supply stable `parent` labels. If a live board has no taxonomy match, group it under `其他`.

- [ ] **Step 4: Render the map in a focused component**

Create `IndustryMarketMap` with props `{ boards, metric, onActivate }`. Render group backgrounds and labels first, then positioned semantic `<button>` items. Each button must expose the full label, change, heat, capital flow, and company count through visible text or `aria-label`. Enter and Space call the same activation callback as click.

- [ ] **Step 5: Replace the old map and style the constellation**

Remove the inline SVG bubble block from `IndustriesPage.tsx`, import `IndustryMarketMap`, and preserve the existing chain/panorama activation callback. Add low-contrast group surfaces, red/green intensity classes, readable two-line labels, focus rings, responsive overflow, and a group breadcrumb in `src/styles.css`.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- --run src/data/industryMarketMap.test.ts src/components/IndustriesPage.test.tsx`

Run: `npm run build`

Expected: all selected tests pass and Vite build exits 0.

```bash
git add src/data/industryMarketMap.ts src/data/industryMarketMap.test.ts src/components/IndustryMarketMap.tsx src/components/IndustriesPage.tsx src/styles.css
git commit -m "feat: group industries into market constellations"
```

### Task 2: Temporary industry-index preview pipeline

**Files:**
- Create: `src/data/industryIndexPreview.ts`
- Create: `src/data/industryIndexPreview.test.ts`
- Modify: `src/components/IndustriesPage.tsx`
- Modify: `src/components/IndustriesPage.test.tsx`

- [ ] **Step 1: Write failing preview-pipeline tests**

```ts
import { describe, expect, it } from 'vitest';
import { buildIndustryIndexPreview, loadIndustryIndexPreview, saveIndustryIndexPreview, toIndustryIndexPreviewHash } from './industryIndexPreview';

const node = { id: 'battery', name: '动力电池', stocks: [{ code: '300750', name: '宁德时代', change: 1, marketCap: 100, pe: 20 }], children: [{ id: 'cell', name: '电芯', stocks: [{ code: '300750', name: '宁德时代', change: 1, marketCap: 100, pe: 20 }, { code: '300014', name: '亿纬锂能', change: 2, marketCap: 50, pe: 18 }], children: [] }] };

it('deduplicates descendants and stores only a transient preview', () => {
  const preview = buildIndustryIndexPreview(node, 'equal', ['新能源汽车', '动力电池'], () => 'preview-1');
  expect(preview.index.components.map((item) => item.code)).toEqual(['300750', '300014']);
  const storage = new MapStorage();
  saveIndustryIndexPreview(preview, storage);
  expect(loadIndustryIndexPreview('preview-1', storage)).toEqual(preview);
  expect(toIndustryIndexPreviewHash(preview.index.id)).toBe('toolbox?tool=index&preview=preview-1');
});
```

Define `MapStorage` in the test with `getItem`, `setItem`, and `removeItem` backed by a `Map<string, string>`.

- [ ] **Step 2: Run the test and verify red**

Run: `npm test -- --run src/data/industryIndexPreview.test.ts`

Expected: FAIL because the preview module does not exist.

- [ ] **Step 3: Implement preview creation and session storage**

```ts
import { collectBranchStocks, type CanvasNode } from './industryCanvas';
import { createCustomIndex, type StoredCustomIndex } from './customIndexStorage';

export const INDUSTRY_INDEX_PREVIEW_KEY = 'alpha-desk-industry-index-previews';
type StorageLike = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export type IndustryIndexPreview = { index: StoredCustomIndex; sourcePath: string[]; totalCompanyCount: number; createdAt: string };

export function buildIndustryIndexPreview(node: CanvasNode, method: 'equal' | 'marketCap', sourcePath: string[], createId = () => crypto.randomUUID()): IndustryIndexPreview {
  const stocks = collectBranchStocks(node).filter((stock) => /^\d{6}$/.test(stock.code));
  const index = createCustomIndex({ name: `${node.name} 指数`, description: `来源：${sourcePath.join(' / ')}`, tags: ['行业预览'], components: stocks.map((stock) => ({ code: stock.code, name: stock.name, industry: stock.industry ?? node.name, marketCap: stock.marketCap ?? undefined, targetWeight: 0 })), weightMethod: method, rebalanceFrequency: 'monthly', baseValue: 100 }, createId);
  return { index, sourcePath, totalCompanyCount: stocks.length, createdAt: new Date().toISOString() };
}

export function saveIndustryIndexPreview(preview: IndustryIndexPreview, storage: StorageLike = window.sessionStorage) {
  const current = JSON.parse(storage.getItem(INDUSTRY_INDEX_PREVIEW_KEY) ?? '{}') as Record<string, IndustryIndexPreview>;
  storage.setItem(INDUSTRY_INDEX_PREVIEW_KEY, JSON.stringify({ ...current, [preview.index.id]: preview }));
}

export function loadIndustryIndexPreview(id: string, storage: StorageLike = window.sessionStorage) {
  const current = JSON.parse(storage.getItem(INDUSTRY_INDEX_PREVIEW_KEY) ?? '{}') as Record<string, IndustryIndexPreview>;
  return current[id] ?? null;
}

export const toIndustryIndexPreviewHash = (id: string) => `toolbox?tool=index&preview=${encodeURIComponent(id)}`;
```

- [ ] **Step 4: Route every preview button through one callback**

Change `IndustriesPage` from `onOpenIndexTool(node, method)` to `onPreviewIndex({ node, method, sourcePath })`. Industry-company panels continue to call `makeIndustryIndexNode`, while canvas branches pass their selected node and breadcrumb names. Disable preview buttons when `collectBranchStocks(node).length === 0` and show `当前标签暂无可计算公司`.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/data/industryIndexPreview.test.ts src/components/IndustriesPage.test.tsx`

Expected: both files pass.

```bash
git add src/data/industryIndexPreview.ts src/data/industryIndexPreview.test.ts src/components/IndustriesPage.tsx src/components/IndustriesPage.test.tsx
git commit -m "feat: create transient industry index previews"
```

### Task 3: Open, select, and calculate the requested preview

**Files:**
- Modify: `src/data/customIndexStorage.ts`
- Modify: `src/data/customIndexStorage.test.ts`
- Modify: `src/App.tsx`

- [ ] **Step 1: Write failing promotion tests**

```ts
import { promoteCustomIndexPreview } from './customIndexStorage';

it('promotes a preview once and selects its id', () => {
  const preview = createCustomIndex({ name: '动力电池指数', components: [{ code: '300750', name: '宁德时代', industry: '动力电池' }], weightMethod: 'equal', rebalanceFrequency: 'monthly' }, () => 'preview-1');
  expect(promoteCustomIndexPreview([], preview)).toEqual([preview]);
  expect(promoteCustomIndexPreview([preview], preview)).toEqual([preview]);
});
```

- [ ] **Step 2: Run the test and verify red**

Run: `npm test -- --run src/data/customIndexStorage.test.ts`

Expected: FAIL because `promoteCustomIndexPreview` is missing.

- [ ] **Step 3: Implement idempotent promotion**

```ts
export function promoteCustomIndexPreview(indices: StoredCustomIndex[], preview: StoredCustomIndex) {
  return indices.some((index) => index.id === preview.id)
    ? indices.map((index) => index.id === preview.id ? preview : index)
    : [...indices, preview];
}
```

- [ ] **Step 4: Make toolbox routing hash-reactive**

Add a `useHashParams()` hook in `App.tsx` that reads the query and subscribes to `hashchange`. Pass `previewId` into `CustomIndexToolPanel`. In `ToolboxPage`, derive which tool is open from the current `tool` parameter rather than one-time `useState` initialization.

```ts
function useHashParams() {
  const read = () => new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const [params, setParams] = useState(read);
  useEffect(() => { const sync = () => setParams(read()); window.addEventListener('hashchange', sync); return () => window.removeEventListener('hashchange', sync); }, []);
  return params;
}
```

- [ ] **Step 5: Load and calculate the requested preview**

On `previewId` change, load the transient preview, merge it into the in-memory index list without writing local storage, set `selectedId`, close the editor, and call the existing index calculation path. Add visible source-path text, `保存到我的指数`, and `返回行业研究` actions. Saving calls `promoteCustomIndexPreview` followed by `saveCustomIndices`.

- [ ] **Step 6: Replace the old App handoff**

In `renderPage`, build and store the preview request, then set `window.location.hash = toIndustryIndexPreviewHash(preview.index.id)`. Remove the current eager `saveCustomIndices([...loadCustomIndices(), index])` call.

- [ ] **Step 7: Verify and commit**

Run: `npm test -- --run src/data/customIndexStorage.test.ts src/data/industryIndexPreview.test.ts`

Run: `npm run build`

Expected: tests pass and build exits 0.

```bash
git add src/data/customIndexStorage.ts src/data/customIndexStorage.test.ts src/App.tsx
git commit -m "fix: open requested industry index preview"
```

### Task 4: Complete recursive canvas editing operations

**Files:**
- Modify: `src/data/industryCanvas.ts`
- Modify: `src/data/industryCanvas.test.ts`
- Modify: `src/data/canvasMindMap.ts`
- Modify: `src/data/canvasMindMap.test.ts`

- [ ] **Step 1: Write failing model and layout tests**

```ts
it('updates descriptions, adds siblings, and removes stocks immutably', () => {
  const described = updateCanvasNodeDescription(canvas, 'materials', '上游材料');
  const sibling = addCanvasSibling(described, 'materials', { id: 'equipment', name: '设备' });
  const removed = removeStockFromCanvasNode(sibling, 'materials', '000002');
  expect(findCanvasNode(removed.root, 'materials')?.description).toBe('上游材料');
  expect(removed.root.children.map((node) => node.id)).toEqual(['materials', 'equipment']);
  expect(findCanvasNode(removed.root, 'materials')?.stocks).toEqual([]);
});

it('reserves space for the expanded node', () => {
  const layout = layoutCanvasMindMap(root, 'battery', { expandedId: 'battery', expandedWidth: 360, expandedHeight: 310 });
  const expanded = layout.nodes.find((node) => node.id === 'battery')!;
  expect(expanded.width).toBe(360);
  expect(layout.nodes.filter((node) => node.id !== 'battery').every((node) => !rectanglesOverlap(node, expanded))).toBe(true);
});
```

- [ ] **Step 2: Run tests and verify red**

Run: `npm test -- --run src/data/industryCanvas.test.ts src/data/canvasMindMap.test.ts`

Expected: FAIL for the new operations and layout options.

- [ ] **Step 3: Implement focused immutable helpers**

Export `findCanvasNode`, `updateCanvasNodeDescription`, `addCanvasSibling`, and `removeStockFromCanvasNode`. Reuse the existing recursive `updateNode` and `touch` functions; sibling insertion finds the parent recursively and inserts after the selected node. Root has no sibling action.

- [ ] **Step 4: Support variable expanded dimensions**

Add `MindMapLayoutOptions` with `expandedId`, `expandedWidth`, and `expandedHeight`. Compute every node's dimensions before assigning rows, use subtree heights to place parents at the vertical center of their children, and calculate links from actual node edges. Export `rectanglesOverlap` for the focused test.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- --run src/data/industryCanvas.test.ts src/data/canvasMindMap.test.ts`

Expected: both files pass.

```bash
git add src/data/industryCanvas.ts src/data/industryCanvas.test.ts src/data/canvasMindMap.ts src/data/canvasMindMap.test.ts
git commit -m "feat: support expanded editable canvas nodes"
```

### Task 5: Move the complete editor into the canvas node

**Files:**
- Create: `src/components/IndustryCanvasNodeEditor.tsx`
- Modify: `src/components/IndustryCanvasMindMap.tsx`
- Modify: `src/components/IndustryCanvasEditor.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add a testable node-editor view model**

Export `getCanvasNodeEditorState(node)` from `IndustryCanvasNodeEditor.tsx` and test it in `src/components/IndustriesPage.test.tsx`:

```ts
expect(getCanvasNodeEditorState(node)).toMatchObject({ directCompanyCount: 2, branchCompanyCount: 5, canUseMarketCap: false });
```

The implementation uses `collectBranchStocks` and `getBranchMetrics`; `canUseMarketCap` is true only when every branch company has a positive market cap.

- [ ] **Step 2: Run the test and verify red**

Run: `npm test -- --run src/components/IndustriesPage.test.tsx`

Expected: FAIL because the node editor does not exist.

- [ ] **Step 3: Build the inline editor component**

`IndustryCanvasNodeEditor` receives the active node, path, canvas callbacks, stock search service, weight method, and index-preview callback. Render actual inputs and buttons for name, description, stock search/results, stock chips with remove actions, metrics with included/total counts, add child, add sibling, delete, equal/market-cap selection, and `用本分支生成指数 K 线`. Stop pointer and wheel propagation inside form controls.

- [ ] **Step 4: Convert the mind map to layered HTML nodes**

Render links in a background SVG and nodes as absolutely positioned HTML elements in a sized canvas layer. Compact nodes are buttons; the active node renders `IndustryCanvasNodeEditor` at the same coordinates. Enter expands, Escape collapses, Tab adds a child, Shift+Tab adds a sibling, and arrow keys move focus to parent/child/previous/next sibling.

- [ ] **Step 5: Add pan and zoom without hiding form controls**

Track `{ x, y, scale }` in `IndustryCanvasMindMap`. Pointer-drag starts only from the blank canvas surface. Provide `缩小`, percentage, `放大`, and `适应画布` buttons. Clamp scale to `0.55–1.5`. Inputs and buttons retain normal pointer behavior.

- [ ] **Step 6: Simplify the outer editor**

Delete the fixed `.industry-canvas-inspector`. Keep only a canvas toolbar containing canvas name, save, share, load link/JSON, zoom controls, and concise shortcut help. Pass editing operations into `IndustryCanvasMindMap`.

- [ ] **Step 7: Style desktop and narrow-screen states**

Use the existing dark terminal palette, gold active path, 12–14 px radii, compact stock chips, and readable input contrast. Expanded nodes use a maximum width of 380 px on desktop and the available canvas width on narrow screens. Ensure the toolbar wraps and the primary K-line action remains visible.

- [ ] **Step 8: Verify and commit**

Run: `npm test -- --run src/components/IndustriesPage.test.tsx src/data/industryCanvas.test.ts src/data/canvasMindMap.test.ts`

Run: `npm run build`

Expected: tests pass and build exits 0.

```bash
git add src/components/IndustryCanvasNodeEditor.tsx src/components/IndustryCanvasMindMap.tsx src/components/IndustryCanvasEditor.tsx src/components/IndustriesPage.test.tsx src/styles.css
git commit -m "feat: edit industry chains directly on canvas"
```

### Task 6: Integration, regression, and visual verification

**Files:**
- Modify only files required by failures found in this task.

- [ ] **Step 1: Run the full automated suite**

Run: `npm test`

Expected: every test file passes with zero failures.

- [ ] **Step 2: Run the production build**

Run: `npm run build`

Expected: TypeScript and Vite complete with exit code 0.

- [ ] **Step 3: Verify the three user journeys in the browser**

At desktop and narrow widths, verify:

1. Latest market → switch heat/change → focus an industry group → activate an industry.
2. Industry or branch → preview index → custom-index tool opens the requested preview → K-line calculates → save → return to industry.
3. Custom chain → expand node → edit name/description → add/remove stock → add child/sibling → preview branch index → collapse and reopen.

Capture and inspect screenshots for the full market map, expanded canvas node, loading/error state, and custom-index preview K-line. Compare them against the approved visual direction and fix visible overflow, weak hierarchy, clipped controls, or unreadable labels.

- [ ] **Step 4: Confirm persistence boundaries**

Open a preview and inspect local storage: it must not appear in `alpha-desk-custom-indices` before save. Save it once, refresh, and confirm exactly one permanent index remains. Confirm transient previews stay in session storage only.

- [ ] **Step 5: Commit final integration fixes**

```bash
git add src
git commit -m "test: verify industry research workflows"
```

Skip the commit if verification required no code changes.
