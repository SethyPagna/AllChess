# AllChess Change Log

This file tracks meaningful changes made during the improvement program. Keep newest entries first.

---

## 2026-05-28

### Repository Organization

- Moved nonessential root configuration into `ops/config/` and `ops/infra/`, leaving root-discovered tool files at the top level.
- Switched Next configuration to `next.config.mjs`, the verified production-build-compatible format for this repo.
- Converted local utility scripts and config files to TypeScript entry points.
- Moved local chess training data out of the repository root into ignored `data/local/chess-data/`.
- Moved global CSS into `src/styles/`.
- Grouped architecture, data, and deployment documentation under dedicated `ops/docs/` topic folders.
- Grouped tests by concern under `ops/tests/api/`, `ops/tests/app/`, `ops/tests/domain/`, `ops/tests/platform/`, `ops/tests/scripts/`, and `ops/tests/maintenance/`.
- Removed the unused flat `src/lib/utils.ts` helper and its unused direct dependencies.
- Replaced nested bot legal-move `flatMap` generation with direct loops to reduce search-time allocations.
- Reworked bot cache-key and variant draw scans to avoid flattening board arrays in hot paths.
- Replaced variant move-generator `flatMap` helpers with direct loops to reduce per-move allocation.
- Replaced remaining nested bot scoring and variant piece-count reducers with direct board scans.
- Replaced variant attack, legal-move, and capture-existence nested board scans with direct early-return loops.
- Removed board-grid render-time `flatMap` allocation while preserving square-level keys.
- Replaced bot passed-pawn blocker nested board scans with a direct early-return helper.
- Replaced D1 catalog rule-line `flatMap` parsing with direct line collection.
- Updated the Cloudflare Workers type package and the transitive `qs` audit patch.
- Removed unused direct variant-engine packages from the install graph, including the `xiangqiops` chain that pulled old browser tooling into production audit results.
- Added organization tests for root files, TypeScript scripts, infrastructure folders, and Markdown freshness.
- Removed the obsolete tracked Python Jungle Chess reference archive from the active application tree.
- Grouped audit, deployment, and maintenance helpers under `ops/scripts/ops/`.
- Moved config, docs, infrastructure, scripts, and tests under `ops/` to keep the repository root compact.

### Documentation

- Updated documentation paths for env templates, Wrangler config, D1 migrations, Docker Compose, and moved TypeScript config.
- Added current package stack ranges to `ops/docs/README.md`.
- Updated progress, decisions, and change-log entries to reflect the current repository structure.

### Dependencies

- Updated verified non-major development packages: Cloudflare Workers types, OpenNext Cloudflare, React types, Vitest, and Wrangler.
- Updated latest package lanes for Lucide React, Node types, ESLint, TypeScript, Playwright, Tailwind CSS, Testing Library React, and Zod.
- Switched Vercel deploy scripts to invoke `vercel@latest` through `npx`, avoiding the vulnerable local CLI dependency tree.
- Added a targeted router override for the patched `path-to-regexp` 8.x line used by the OpenNext/Express toolchain.
- Added ESLint compatibility shims for the Next.js lint presets under ESLint 10.
- Added the TypeScript 6 deprecation acknowledgement required by the shared app tsconfig.
- Extended maintenance tests to guard documented package versions and the no-local-Vercel-CLI policy.

---

## 2026-05-21

### Repository Organization

- Moved roadmap tracking files into `ops/docs/roadmap/` to keep the repository root focused on build, deployment, and runtime configuration.
- Updated README and roadmap references to point at the new documentation location.

### Ops

- Hardened browser validation so it discovers the installed browser client dynamically.
- Corrected catalog native display names and clarified catalog sync source errors.

---

## 2026-05-16

### Planning And Tracking

- Added `plan.md` with a 20-phase improvement roadmap covering workflow, design, architecture, variant diversity, functional completeness, testing, security, deployment, and launch readiness.
- Added `progress.md` with phase statuses, active queue, baseline repository map, high-risk edit areas, verification log, blockers, decisions needed, and commit checklist.
- Added `decisions.md` with initial decisions for root-level tracking, Cloudflare-first architecture, and variant support capability tracking.
- Added `change-log.md` as the running record for roadmap changes.

### Verification

- Confirmed the branch was clean before adding planning files.
- Full phase verification commands have not yet been run because this commit only introduces planning and tracking documents.
