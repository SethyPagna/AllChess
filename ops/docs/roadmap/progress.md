# AllChess Progress Tracker

**Current Phase:** Phase 02 - Development Workflow And Quality Gates

**Current Status:** Repository organization and verification workflow cleanup are complete; next work should continue phase-scoped product improvements.

**Last Updated:** 2026-05-28

---

## Status Legend

- `Not Started`: no implementation work has begun.
- `In Progress`: actively being changed or audited.
- `Blocked`: cannot proceed without a decision, dependency, credential, or failing prerequisite.
- `Verifying`: implementation is complete and checks are running.
- `Done`: implementation, docs, verification, and commit are complete.

## Phase Tracker

| Phase | Name | Status | Target Outcome | Verification Note |
| --- | --- | --- | --- | --- |
| 01 | Product Baseline And Workflow Audit | Done | Baseline repo, workflow, and product journey map | Repository map, high-risk areas, and current verification status are recorded |
| 02 | Development Workflow And Quality Gates | In Progress | Reliable local workflow and PR checklist | Root config cleanup, TypeScript scripts, and docs freshness tests are in place |
| 03 | Architecture Boundaries And Module Ownership | In Progress | Clear module ownership and dependency direction | Domain folders and infrastructure folders are documented |
| 04 | Core Game Domain Completeness | Not Started | Complete lifecycle, move, outcome, and clock contracts | Not run |
| 05 | Rules Engine Normalization | Not Started | Predictable rules adapter surface for all variants | Not run |
| 06 | Variant Diversity And Catalog Depth | Not Started | Richer catalog taxonomy and honest support statuses | Not run |
| 07 | Board Interaction And Move UX | Not Started | Consistent mouse, touch, and keyboard move input | Not run |
| 08 | Information Architecture And Navigation Workflow | Not Started | Efficient app routes and user workflows | Not run |
| 09 | Visual Design System And Responsive Polish | Not Started | Durable UI system and responsive layouts | Not run |
| 10 | Accessibility And Internationalization | Not Started | Better keyboard, screen reader, contrast, and locale support | Not run |
| 11 | Auth, Profiles, And Account Workflow | Not Started | Complete identity, profile, and settings flows | Not run |
| 12 | Realtime Rooms, Lobby, And Matchmaking | Not Started | Reliable multiplayer discovery and live state | Not run |
| 13 | Bot System, Difficulty, And Training Workflow | Not Started | Calibrated, transparent bots across variants | Not run |
| 14 | Analysis, Review, And Learning Functions | Not Started | Useful post-game review and practice bridge | Not run |
| 15 | Practice, Lessons, And Skill-Building Workflow | Not Started | Structured improvement loop for players | Not run |
| 16 | Persistence, D1 Schema, And Data Integrity | Not Started | Consistent storage, repositories, and migrations | Not run |
| 17 | Performance, Bundle Health, And Runtime Efficiency | Not Started | Faster frontend and backend under real load | Not run |
| 18 | Security, Privacy, And Abuse Resistance | Not Started | Hardened inputs, secrets, authz, and throttles | Not run |
| 19 | Deployment, Observability, And Operations | Not Started | Predictable deploys and operational checks | Not run |
| 20 | Completeness Review And Launch Hardening | Not Started | Final readiness review and release notes | Not run |

---

## Active Work Queue

1. Continue Phase 02 by keeping package scripts, docs, and verification commands aligned.
2. Continue Phase 03 by moving only domain files that can be verified with focused tests.
3. Use `npm run verify` before claiming root, script, config, or docs cleanup is complete.
4. Record accepted architecture or workflow changes in `ops/docs/roadmap/decisions.md` and `ops/docs/roadmap/change-log.md`.

## Baseline Repository Map

Initial map from repository inspection:

- App routes live in `src/app`, including locale-scoped pages for home, play, lobby, practice, watch, history, analysis, settings, login, leaderboards, variants, games, and profiles.
- API routes live in `src/app/api`, including analysis, bots, catalog, game families, games, live stats, matchmaking, rooms, rules, and leaderboards.
- Shared UI components live in domain folders under `src/components`, including board, shell, catalog, play, auth, analysis, and small shared UI primitives.
- Domain libraries live in `src/lib`, including variants, catalog, bots, bot training, stockfish, clocks, game review, game outcome, auth, Cloudflare, realtime, storage, i18n, and validation.
- Tests live in `tests` with unit, component, persistence, platform, bot, i18n, performance, and Playwright coverage.
- Deployment and runtime configuration live in `ops/infra/cloudflare/wrangler.jsonc`, `ops/infra/docker/*`, `ops/config/test/*`, `ops/config/lint/*`, `ops/config/typescript/*`, `open-next.config.ts`, `vercel.json`, Cloudflare docs, and package scripts.

## High-Risk Edit Areas

- `src/components/board/game-board.tsx`: central board UI; changes can affect every play surface.
- `src/lib/variants/*`: rules behavior and catalog compatibility; changes can invalidate many variants.
- `src/app/api/games/*`: move application and persistence path; changes affect live games and history.
- `src/lib/realtime/*`: room state and Durable Object behavior; changes affect multiplayer reliability.
- `src/lib/bot/*`: bot strength, generated knowledge, Stockfish bridge, and runtime asset behavior.
- `src/lib/auth/*`: session and identity behavior; changes must be security-reviewed.
- `ops/infra/cloudflare/d1/migrations/*`: production data integrity; changes require explicit migration verification.
- `src/styles/globals.css`: broad UI impact; changes require responsive and visual review.

## Verification Log

| Date | Phase | Command | Result | Notes |
| --- | --- | --- | --- | --- |
| 2026-05-16 | Planning | `git status --short --branch` | Pass | Branch `main` was clean and ahead of `origin/main` by 1 commit before planning docs were added |
| 2026-05-28 | Repository organization | `npm run verify` | Pass | Lint, typecheck, unit tests, and production build passed after root config and TypeScript script cleanup |
| 2026-05-28 | Documentation freshness | `npm test -- ops/tests/maintenance/markdown-docs.test.ts` | Pass | Markdown docs are checked for moved paths and current package stack versions |

## Blockers

- No blockers recorded.

## Decisions Needed

- Decide whether each phase should be implemented inline or split into separate branches.
- Decide how aggressive variant expansion should be before rules adapter coverage is complete.
- Decide whether to create a dedicated docs folder for long-term roadmap artifacts after the initial root tracking files stabilize.

## Commit Checklist

Before each phase commit:

- Phase tracker status updated.
- Verification log updated with commands and results.
- `ops/docs/roadmap/decisions.md` updated for architecture or product choices.
- `ops/docs/roadmap/change-log.md` updated for user-visible, technical, workflow, or documentation changes.
- `git status --short` reviewed so unrelated user changes are not staged.
