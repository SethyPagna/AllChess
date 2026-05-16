# AllChess Progress Tracker

**Current Phase:** Phase 01 - Product Baseline And Workflow Audit

**Current Status:** Planning baseline created. Implementation has not started.

**Last Updated:** 2026-05-16

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
| 01 | Product Baseline And Workflow Audit | In Progress | Baseline repo, workflow, and product journey map | Planning docs created; audit commands still need to run for this phase |
| 02 | Development Workflow And Quality Gates | Not Started | Reliable local workflow and PR checklist | Not run |
| 03 | Architecture Boundaries And Module Ownership | Not Started | Clear module ownership and dependency direction | Not run |
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

1. Complete Phase 01A by mapping files and high-risk edit areas.
2. Complete Phase 01B by walking user journeys in the browser.
3. Complete Phase 01C by running baseline verification commands.
4. Commit baseline docs and notes.

## Baseline Repository Map

Initial map from repository inspection:

- App routes live in `src/app`, including locale-scoped pages for home, play, lobby, practice, watch, history, analysis, settings, login, leaderboards, variants, games, and profiles.
- API routes live in `src/app/api`, including analysis, bots, catalog, game families, games, live stats, matchmaking, rooms, rules, and leaderboards.
- Shared UI components live in `src/components`, including game board, navigation, catalog browser, auth card, notifications, rules panel, theme controls, and variant cards.
- Domain libraries live in `src/lib`, including variants, catalog, bots, bot training, stockfish, clocks, game review, game outcome, auth, Cloudflare, realtime, storage, i18n, and validation.
- Tests live in `tests` with unit, component, persistence, platform, bot, i18n, performance, and Playwright coverage.
- Deployment and runtime configuration live in `wrangler.jsonc`, `open-next.config.ts`, `vercel.json`, Docker files, Cloudflare docs, and package scripts.

## High-Risk Edit Areas

- `src/components/game-board.tsx`: central board UI; changes can affect every play surface.
- `src/lib/variants/*`: rules behavior and catalog compatibility; changes can invalidate many variants.
- `src/app/api/games/*`: move application and persistence path; changes affect live games and history.
- `src/lib/realtime/*`: room state and Durable Object behavior; changes affect multiplayer reliability.
- `src/lib/bots*` and `src/lib/stockfish-engine.ts`: bot strength, generated knowledge, and runtime asset behavior.
- `src/lib/auth/*`: session and identity behavior; changes must be security-reviewed.
- `migrations/*`: production data integrity; changes require explicit migration verification.
- `src/app/globals.css`: broad UI impact; changes require responsive and visual review.

## Verification Log

| Date | Phase | Command | Result | Notes |
| --- | --- | --- | --- | --- |
| 2026-05-16 | Planning | `git status --short --branch` | Pass | Branch `main` was clean and ahead of `origin/main` by 1 commit before planning docs were added |

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
- `decisions.md` updated for architecture or product choices.
- `change-log.md` updated for user-visible, technical, workflow, or documentation changes.
- `git status --short` reviewed so unrelated user changes are not staged.
