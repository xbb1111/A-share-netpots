# Project Context Handoff Design

## Purpose

Create a repository-level `PROJECT_CONTEXT.md` that lets the owner, Codex, or another developer resume work after moving to a new computer without depending on a previous chat session or machine-local state.

## Audience

- The project owner restoring the repository on another computer.
- Codex or another assistant taking over the project with no prior conversation history.
- A developer who needs to distinguish local development from the deployed GitHub Pages application.

## Source of truth

The document must only contain information supported by the current repository, Git history, existing design documents, deployment configuration, or the owner's statements in the current conversation. Unverified assumptions must be labeled explicitly or omitted.

## Required content

The single-file handoff must include:

1. A prominent instruction telling future Codex sessions to read the file before changing the project.
2. Project purpose, technology stack, major capabilities, and repository identity.
3. A concise architecture map covering the React/Vite frontend, the local Node API, the Cloudflare Worker API, GitHub Pages, and external public market-data sources.
4. The exact distinction between local development and production API routing:
   - local `/api` requests proxy to `http://localhost:8787`;
   - GitHub Pages uses the configured financial-report API base or the repository's Worker fallback address.
5. Environment and deployment information, including GitHub Actions, repository variable names, Cloudflare authentication requirements, and files or credentials that Git does not transfer.
6. Commands for installation, local startup, testing, building, Worker development, and Worker deployment.
7. A guide to important directories, source files, tests, and existing specifications/plans.
8. Project memory reconstructed from recent Git history and existing design documents, including important implementation decisions and recently completed work.
9. A clearly dated current-state snapshot, known limitations, and a maintainable next-work section.
10. A new-computer recovery checklist covering both Git cloning and full-folder copying.
11. Rules for keeping `PROJECT_CONTEXT.md` current after meaningful architecture, deployment, interface, or roadmap changes.

## Safety and privacy

- Do not include tokens, passwords, private keys, or secret values.
- Mention secret and variable names only.
- Clearly distinguish version-controlled files from machine-local files, browser data, local storage, platform credentials, and deployed service state.
- Do not claim that cloning the repository reproduces Cloudflare or GitHub account authentication.

## Success criteria

The handoff is complete when a fresh Codex session can read `PROJECT_CONTEXT.md` and correctly explain:

- what the project does;
- how to run it locally;
- why local and deployed API behavior differ;
- what is and is not restored by cloning or copying the folder;
- where important implementation decisions are documented;
- the project's current verified status and logical next steps.

The document must contain no `TBD` or `TODO` placeholders and must not expose secrets.
