# Industry Research Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a packed-bubble market map, expandable industry tree, and editable/shareable nested supply-chain canvas linked to Price Discipline and Custom Index.

**Architecture:** Keep recursive canvas data, metrics, storage, sharing and tool-navigation instructions in pure data modules. Keep UI in focused industry components; pass one-time instructions through app-level state to existing toolbox panels.

**Tech Stack:** React 19, TypeScript 5.9, Vitest 4, SVG, localStorage, existing Worker API.

---

### Task 1: Recursive canvas domain and local persistence

**Files:** Create `src/data/industryCanvas.ts`, `src/data/industryCanvas.test.ts`, `src/data/industryCanvasStorage.ts`, `src/data/industryCanvasStorage.test.ts`.

- [ ] Write failing tests for descendant-stock de-duplication, add/remove/rename recursive nodes, invalid PE filtering, and import-as-new-copy.
- [ ] Run `npm test -- src/data/industryCanvas.test.ts src/data/industryCanvasStorage.test.ts`; confirm missing-module failure.
- [ ] Implement `CanvasStock`, recursive `CanvasNode`, versioned `IndustryCanvas`, and `BranchMetrics`; expose immutable find/update helpers, deduplicated descendant collection, average change/market-cap/positive-PE metrics, and PE coverage.
- [ ] Persist validated canvases under `alpha-desk-industry-canvases`; import assigns a fresh ID/timestamps and never overwrites a saved canvas.
- [ ] Re-run focused tests and commit `feat: add recursive industry canvas model`.

### Task 2: Share format and constituent PE data

**Files:** Modify `src/data/industryCanvas.ts`, `src/data/industryCanvas.test.ts`, `src/data/types.ts`, `src/data/industryService.ts`, `src/data/industryService.test.ts`, `server/financial-report-api.mjs`, `server/financial-report-api.test.mjs`.

- [ ] Write failing tests for link round-trip, malformed link rejection, oversized-share text fallback, and company PE mapping.
- [ ] Run focused tests; confirm missing codec/PE failure.
- [ ] Add nullable `pe` to industry company quotes and request/map Eastmoney field `f9` through the Worker.
- [ ] Encode versioned canvas JSON as URL-safe base64 in the `canvas` hash parameter; validate every imported node and security. Return a copyable JSON-text payload when the generated link exceeds 6,000 characters.
- [ ] Re-run focused tests and commit `feat: share industry canvases and branch PE metrics`.

### Task 3: Bubble map and expandable industry tree

**Files:** Create `src/data/industryVisualization.ts`, `src/data/industryVisualization.test.ts`; modify `src/components/IndustriesPage.tsx`, `src/components/IndustriesPage.test.tsx`, `src/styles.css`.

- [ ] Write failing tests for deterministic non-overlapping SVG bubbles, metric-based radius, color semantics, one-level tree expansion, leaf company loading, and URL restoration.
- [ ] Run focused tests; confirm expected helper/component failure.
- [ ] Replace rectangular cloud tiles with bounded SVG packed circles. Heat/change selects radius; red/green reflects trend; tooltips and focus labels retain full values.
- [ ] Render verified `parentCode` relationships as an ARIA tree. Clicking non-leaf only toggles that node; clicking a leaf selects it. Keep unparented data visible under `未归类` instead of inventing parent paths.
- [ ] Re-run focused tests and commit `feat: add packed industry bubbles and expandable tree`.

### Task 4: Editable industry canvas workspace

**Files:** Create `src/components/IndustryCanvasEditor.tsx`, `src/components/IndustryCanvasEditor.test.tsx`; modify `src/components/IndustriesPage.tsx`, `src/styles.css`.

- [ ] Write failing tests for nested node editing, security search with `searchSecuritySuggestions`, one-click de-duplicated addition, save, share import, and metrics coverage display.
- [ ] Run focused tests; confirm editor failure.
- [ ] Move popular chains to the top and add `我的产业链`, new, save, share, and load-link controls.
- [ ] Implement recursive outline/inspector with add child, rename, delete, reorder, stock search/add/remove, branch statistics, and share import validation feedback.
- [ ] Re-run focused tests and commit `feat: add editable shareable industry canvases`.

### Task 5: Branch preview and toolbox handoffs

**Files:** Create `src/data/toolNavigation.ts`, `src/data/toolNavigation.test.ts`; modify `src/App.tsx`, `src/components/IndustryCanvasEditor.tsx`, `src/data/customIndexStorage.ts`, `src/data/customIndexStorage.test.ts`.

- [ ] Write failing tests for `price` and `index-preview` instructions, equal and market-cap branch preview configs, and save-only-after-confirmation behavior.
- [ ] Run focused tests; confirm navigation helper failure.
- [ ] Add app-level/sessionStorage-backed one-time tool instructions. Individual stock opens Price Discipline with its code; a branch creates an unsaved daily base-100 preview with equal/market-cap toggle.
- [ ] Disable market-cap preview when any required market cap is missing. On confirmation, create a normal `StoredCustomIndex`, open Custom Index, and leave all custom weighting edits to that tool.
- [ ] Re-run focused tests and commit `feat: link industry branches to research tools`.

### Task 6: Full verification and deployment

**Files:** Modify only verified defect files.

- [ ] Run `npm test` and require all existing/new tests to pass.
- [ ] Run `npm run build` and require TypeScript/Vite success.
- [ ] Browser-check packed circles, tree expansion, recursive editing, link import, PE coverage, equal/market-cap preview, Price Discipline handoff, Custom Index save, and narrow-screen layout.
- [ ] Push `main`, wait for Pages deployment for the pushed SHA, and verify Worker API-backed industry data on the deployed site.
