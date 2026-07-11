# Custom Industry Mind Map and Market Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom industry-chain form with a recursive mind-map editor and make the industry bubble chart a compact, readable market map.

**Architecture:** Keep recursive canvas mutations and deterministic layout algorithms in pure data modules. Render both the custom canvas and the market map as SVG-like spatial views with a separate selected-node inspector, preserving localStorage, share links, stock search, branch metrics, and existing toolbox handoffs.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, SVG, localStorage, lucide-react.

---

### Task 1: Deterministic non-grid market-map layout

**Files:**
- Modify: `src/data/industryVisualization.ts`
- Modify: `src/data/industryVisualization.test.ts`
- Modify: `src/components/IndustriesPage.tsx`
- Modify: `src/styles.css`

- [ ] Write a failing test proving a high-priority bubble has a larger radius and the layout does not put every bubble on the same row/column grid.
- [ ] Run `npm test -- src/data/industryVisualization.test.ts`; confirm the current grid layout fails the non-grid assertion.
- [ ] Replace `buildIndustryBubbles` with a deterministic spiral/ring packer: order by selected metric, attempt placement at increasing polar angles, reject overlaps, and calculate container height from the final bounds.
- [ ] Add `width` and `height` to each rendered bubble's viewbox bounds so the SVG has responsive whitespace instead of a dense repeated circle matrix.
- [ ] Update bubble visuals: metric-ranked top bubbles receive a subtle halo, labels use a two-line hierarchy, and all bubbles preserve accessible titles and keyboard focus.
- [ ] Run `npm test -- src/data/industryVisualization.test.ts src/components/IndustriesPage.test.tsx` and commit `feat: refine industry market map`.

### Task 2: Recursive mind-map layout for custom canvases

**Files:**
- Create: `src/data/canvasMindMap.ts`
- Create: `src/data/canvasMindMap.test.ts`
- Modify: `src/components/IndustryCanvasEditor.tsx`
- Create: `src/components/IndustryCanvasMindMap.tsx`
- Modify: `src/styles.css`

- [ ] Write failing tests for depth-first mind-map placement, selected-node path calculation, and a canvas with children nested three levels deep.
- [ ] Run `npm test -- src/data/canvasMindMap.test.ts`; confirm the helper module is missing.
- [ ] Implement `buildCanvasMindMap(root)` returning positioned nodes, parent-child links, and total bounds. Place the root at x=0, arrange children by subtree height, and use horizontal depth columns so arbitrary nesting remains legible.
- [ ] Implement `getCanvasNodePath(root, id)` and use it in the inspector breadcrumb.
- [ ] Render `IndustryCanvasMindMap`: root card, link lines, selected-node highlighting, collapsed child groups, and an “add child” action on each selected node.
- [ ] Run the focused tests and commit `feat: add recursive custom industry mind map`.

### Task 3: Inspector-first custom canvas editing

**Files:**
- Modify: `src/components/IndustryCanvasEditor.tsx`
- Create: `src/components/IndustryCanvasEditor.test.tsx`
- Modify: `src/styles.css`

- [ ] Write failing tests for selecting a nested node, adding one child, breadcrumb rendering, and showing deduplicated branch metrics in the inspector.
- [ ] Run `npm test -- src/components/IndustryCanvasEditor.test.tsx`; confirm the current outline/form layout lacks the tested view model.
- [ ] Replace the left outline with a two-pane workspace: mind-map canvas on the left and node inspector on the right.
- [ ] Keep editing operations in the inspector: rename, add child, stock search and one-click add, selected-stock removal, branch metrics, equal/market-cap preview switch, share/load controls, and save.
- [ ] For narrow screens, stack the inspector under the mind map and make the diagram horizontally scrollable; do not hide nodes or controls.
- [ ] Run the focused test and commit `feat: make custom canvas inspector driven`.

### Task 4: End-to-end verification and publication

**Files:** Modify only verified defect files.

- [ ] Run `npm test` and require all tests to pass.
- [ ] Run `npm run build` and require TypeScript/Vite success.
- [ ] Browser-check: non-grid market map, metric switch, bubble navigation, nested custom node creation, stock addition, share/load, nested branch metrics, price discipline handoff, and custom-index handoff.
- [ ] Merge to `main`, push, wait for GitHub Pages success, and verify the deployed industry page loads industry boards and component companies.
