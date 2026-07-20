# Project Context Handoff Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a repository-level `PROJECT_CONTEXT.md` that preserves verified project memory and supports resuming work on a new computer.

**Architecture:** Use one Markdown handoff file at the repository root as the first-read source for future Codex sessions and developers. Derive every factual statement from tracked configuration, source code, Git history, existing specifications/plans, or the owner's confirmed requirements; keep secrets and machine-local values out of the document.

**Tech Stack:** Markdown, Git, React 19, TypeScript, Vite 7, Vitest, Node.js API, Cloudflare Workers, GitHub Pages

---

### Task 1: Reconstruct verified project context

**Files:**
- Read: `README.md`
- Read: `package.json`
- Read: `vite.config.ts`
- Read: `wrangler.toml`
- Read: `.github/workflows/pages.yml`
- Read: `src/data/financialReportService.ts`
- Read: `docs/superpowers/specs/*.md`
- Read: `docs/superpowers/plans/*.md`

- [ ] **Step 1: Inspect runtime and deployment configuration**

Run:

```powershell
Get-Content package.json,vite.config.ts,wrangler.toml,.github/workflows/pages.yml
```

Expected: local API proxy, Worker entry point, GitHub Pages workflow, package scripts, and repository variable names are visible.

- [ ] **Step 2: Inspect project history and existing decisions**

Run:

```powershell
git log --oneline -20
Get-ChildItem docs/superpowers/specs,docs/superpowers/plans -File
```

Expected: recent completed work and the authoritative design/plan documents are identified.

### Task 2: Create the single-file handoff

**Files:**
- Create: `PROJECT_CONTEXT.md`

- [ ] **Step 1: Write the handoff document**

Create `PROJECT_CONTEXT.md` with these complete sections:

```markdown
# A-share-netpots Project Context

> Future Codex sessions: read this file before changing the project.

## Document status
## Project identity and purpose
## Technology stack
## Architecture and data flow
## Local versus deployed API behavior
## Major capabilities
## Important files and directories
## Verified project memory and design decisions
## Current verified state
## Installation and local development
## Testing and production build
## GitHub Pages and Cloudflare Worker deployment
## What Git and folder copying do not transfer
## New-computer recovery checklist
## Known limitations and next work
## Maintenance rules for this document
```

For every section, include concrete repository-derived facts. Explain that local `/api` requests proxy to `http://localhost:8787`, while GitHub Pages uses `VITE_FINANCIAL_REPORT_API_BASE` or the tracked Worker fallback. List secret names only, never secret values.

### Task 3: Validate and commit the handoff

**Files:**
- Verify: `PROJECT_CONTEXT.md`
- Commit: `PROJECT_CONTEXT.md`

- [ ] **Step 1: Check completeness and unsafe content**

Run:

```powershell
rg -n "TBD|TODO|password|api[_-]?token|private[_-]?key" PROJECT_CONTEXT.md
git diff --check
```

Expected: no placeholders, no credential values, and no whitespace errors. Mentions of credential variable names must be explanatory only.

- [ ] **Step 2: Verify repository state**

Run:

```powershell
git diff -- PROJECT_CONTEXT.md
git status --short --branch
```

Expected: only the intended handoff file is pending after the already committed design and plan documents.

- [ ] **Step 3: Commit the handoff**

Run:

```powershell
git add PROJECT_CONTEXT.md
git commit -m "docs: add project context handoff"
```

Expected: Git creates one documentation commit containing `PROJECT_CONTEXT.md`.
