# AllChess Change Log

This file tracks meaningful changes made during the improvement program. Keep newest entries first.

---

## 2026-05-28

### Repository Organization

- Moved nonessential root configuration into `config/` and `infra/`, leaving root-discovered tool files at the top level.
- Switched Next configuration to `next.config.mjs`, the verified production-build-compatible format for this repo.
- Converted local utility scripts and config files to TypeScript entry points.
- Moved local chess training data out of the repository root into ignored `data/local/chess-data/`.
- Moved global CSS into `src/styles/`.
- Grouped architecture, data, and deployment documentation under dedicated `docs/` topic folders.
- Grouped tests by concern under `tests/api/`, `tests/app/`, `tests/domain/`, `tests/platform/`, `tests/scripts/`, and `tests/maintenance/`.
- Removed the unused flat `src/lib/utils.ts` helper and its unused direct dependencies.
- Replaced nested bot legal-move `flatMap` generation with direct loops to reduce search-time allocations.
- Reworked bot cache-key and variant draw scans to avoid flattening board arrays in hot paths.
- Replaced variant move-generator `flatMap` helpers with direct loops to reduce per-move allocation.
- Updated the Cloudflare Workers type package and the transitive `qs` audit patch.
- Removed unused direct variant-engine packages from the install graph, including the `xiangqiops` chain that pulled old browser tooling into production audit results.
- Added organization tests for root files, TypeScript scripts, infrastructure folders, and Markdown freshness.
- Removed the obsolete tracked Python Jungle Chess reference archive from the active application tree.

### Documentation

- Updated documentation paths for env templates, Wrangler config, D1 migrations, Docker Compose, and moved TypeScript config.
- Added current package stack ranges to `docs/README.md`.
- Updated progress, decisions, and change-log entries to reflect the current repository structure.

### Dependencies

- Updated verified non-major development packages: Cloudflare Workers types, OpenNext Cloudflare, React types, Vitest, and Wrangler.
- Left major upgrade lanes documented as migration candidates instead of applying them opportunistically.

---

## 2026-05-21

### Repository Organization

- Moved roadmap tracking files into `docs/roadmap/` to keep the repository root focused on build, deployment, and runtime configuration.
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
