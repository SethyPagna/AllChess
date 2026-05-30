# AllChess Improvement Master Plan

> Tracking pair: update `ops/docs/roadmap/progress.md` after every meaningful work session, add accepted architectural choices to `ops/docs/roadmap/decisions.md`, and summarize completed changes in `ops/docs/roadmap/change-log.md`.

**Goal:** Improve AllChess across workflow, design, architecture, variant diversity, function coverage, and product completeness until it feels like a coherent chess ecosystem instead of a collection of partly connected surfaces.

**Architecture Direction:** Keep the active app as a Next.js 16, TypeScript-first, Cloudflare-first system. Preserve Cloudflare D1, R2, Durable Objects, and OpenNext as the deployment spine while tightening domain boundaries around rules, games, rooms, bots, analysis, auth, catalog, and UI workflows.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Playwright, Cloudflare Workers, D1, R2, Durable Objects, Stockfish, chess.js for offline training, first-party variant rules, and Tailwind CSS.

**Operating Rule:** Each phase must leave the repository healthier than it found it. Every phase ends with documentation updates, verification, and a focused commit.

---

## Tracking System

Use these files together:

- `ops/docs/roadmap/plan.md`: master 20-phase roadmap with mini phases, targets, subtargets, verification gates, and commit gates.
- `ops/docs/roadmap/progress.md`: current status, active phase, completed checks, blockers, and next actions.
- `ops/docs/roadmap/decisions.md`: architecture and product decisions that should not be rediscovered later.
- `ops/docs/roadmap/change-log.md`: human-readable summary of completed changes, grouped by date and phase.

Each implementation session should follow this loop:

1. Pick one phase and one mini phase from `ops/docs/roadmap/plan.md`.
2. Move the item to `In Progress` in `ops/docs/roadmap/progress.md`.
3. Write or update tests before changing behavior when the change is functional.
4. Make the smallest coherent implementation.
5. Run the verification commands listed for that phase.
6. Update `ops/docs/roadmap/progress.md`, `ops/docs/roadmap/decisions.md` when a decision is made, and `ops/docs/roadmap/change-log.md`.
7. Commit with a phase-scoped message such as `phase 03: map architecture boundaries`.

## Global Definition Of Done

A phase is complete only when all applicable checks pass:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run audit:live` for browser-visible workflow changes
- `npm run audit:env -- cloudflare` for deployment, auth, storage, AI, or Cloudflare configuration changes

If a command cannot run locally, record the reason in `ops/docs/roadmap/progress.md` and add the remaining risk to `ops/docs/roadmap/change-log.md`.

---

## Phase 01: Product Baseline And Workflow Audit

**Target:** Establish a truthful baseline of current product flows, repo health, and development workflow.

**Mini Phase 01A - Repository Map**

- Subtarget: Map active app routes, API routes, domain libraries, tests, scripts, and deployment files.
- Subtarget: Identify files that are central to multiple workflows and mark them as high-risk edit areas.
- Output: `ops/docs/roadmap/progress.md` updated with a repository map summary and baseline risks.

**Mini Phase 01B - User Journey Inventory**

- Subtarget: Walk the main flows: home, variants, play, lobby, practice, watch, history, analysis, login, settings, profile, leaderboards.
- Subtarget: Record missing transitions, confusing dead ends, inconsistent copy, and workflow friction.
- Output: Prioritized journey gaps in `ops/docs/roadmap/progress.md`.

**Mini Phase 01C - Verification Baseline**

- Subtarget: Run lint, typecheck, unit tests, build, and live audit if the browser stack is available.
- Subtarget: Record failing commands exactly, including first actionable failure.
- Output: Baseline verification section in `ops/docs/roadmap/progress.md`.

**Verification Gate:** `npm run lint`, `npm run typecheck`, `npm run test`, `npm run build`.

**Commit Gate:** Commit docs and baseline notes with `phase 01: document product baseline`.

---

## Phase 02: Development Workflow And Quality Gates

**Target:** Make routine development repeatable, visible, and hard to accidentally break.

**Mini Phase 02A - Script Review**

- Subtarget: Confirm each script in `package.json` has a clear purpose and works on Windows PowerShell.
- Subtarget: Add missing helper scripts only when they reduce repeated manual command sequences.
- Output: Script notes in `ops/docs/roadmap/progress.md` and README updates when commands change.

**Mini Phase 02B - Test Organization**

- Subtarget: Group tests by domain intent: variants, board UI, realtime, persistence, bots, i18n, deployment, analysis.
- Subtarget: Ensure naming makes failure ownership obvious.
- Output: Test ownership matrix in `ops/docs/roadmap/progress.md`.

**Mini Phase 02C - Pull Request Checklist**

- Subtarget: Add a concise local checklist covering tests, docs, screenshots for UI, env audits for deploy changes, and migration checks for D1.
- Subtarget: Make commit expectations explicit: one coherent change per commit, docs updated with behavior changes.
- Output: PR checklist in docs or README.

**Verification Gate:** `npm run verify`.

**Commit Gate:** Commit workflow changes with `phase 02: strengthen development workflow`.

---

## Phase 03: Architecture Boundaries And Module Ownership

**Target:** Clarify system boundaries so new features land in predictable places.

**Mini Phase 03A - Boundary Map**

- Subtarget: Define ownership for app routes, API routes, rules, catalog, variants, bots, auth, storage, realtime, analysis, and UI components.
- Subtarget: Mark allowed dependencies between domains.
- Output: Architecture boundary map in `ops/docs/roadmap/decisions.md` or a dedicated docs file.

**Mini Phase 03B - Shared Type Audit**

- Subtarget: Review `src/lib/variants/types.ts`, catalog types, realtime types, auth session types, and API response shapes.
- Subtarget: Identify duplicated or drifting concepts such as variant keys, game ids, player ids, move formats, and time controls.
- Output: Type consolidation targets in `ops/docs/roadmap/progress.md`.

**Mini Phase 03C - Dependency Direction Cleanup**

- Subtarget: Move domain logic out of React components where it blocks testing.
- Subtarget: Keep API serialization separate from internal domain calculations.
- Output: Small refactors with tests.

**Verification Gate:** `npm run lint`, `npm run typecheck`, `npm run test`.

**Commit Gate:** Commit boundary changes with `phase 03: clarify architecture boundaries`.

---

## Phase 04: Core Game Domain Completeness

**Target:** Make game creation, move application, outcome detection, clocks, and persistence operate through one coherent model.

**Mini Phase 04A - Game Lifecycle Model**

- Subtarget: Define complete states: created, waiting, active, paused, completed, abandoned, archived.
- Subtarget: Define transitions and responsible modules for each transition.
- Output: Lifecycle decision recorded in `ops/docs/roadmap/decisions.md`.

**Mini Phase 04B - Move Application Contract**

- Subtarget: Standardize input and output for applying a move across API routes, local UI, bots, realtime, and persistence.
- Subtarget: Ensure illegal moves return structured errors, not inconsistent strings.
- Output: Contract tests for legal move, illegal move, checkmate, draw, resignation, timeout, and abandonment.

**Mini Phase 04C - Clock And Time Control Coverage**

- Subtarget: Verify base time, increment, delay, correspondence, untimed, and bot-friendly limits.
- Subtarget: Ensure clock behavior is deterministic in tests.
- Output: Clock tests and route-level safeguards.

**Verification Gate:** `npm run test -- game`, `npm run typecheck`, `npm run test`.

**Commit Gate:** Commit domain work with `phase 04: complete game lifecycle model`.

---

## Phase 05: Rules Engine Normalization

**Target:** Give every supported variant a predictable rules adapter and validation surface.

**Mini Phase 05A - Rules Adapter Interface**

- Subtarget: Confirm adapter responsibilities: initial position, legal moves, move parsing, move application, outcome detection, notation, promotion, repetition, and draw rules.
- Subtarget: Document which responsibilities are delegated to external libraries versus owned modules.
- Output: Adapter contract documented in code comments or docs.

**Mini Phase 05B - Variant Rule Coverage Matrix**

- Subtarget: Build a matrix for classic chess, Chess960, xiangqi, shogi, makruk, janggi, sittuyin, courier, capablanca, crazyhouse, bughouse, atomic, horde, racing kings, antichess, three-check, king of the hill, and other launch candidates.
- Subtarget: Mark each as playable, review-only, research, or blocked.
- Output: Matrix in `ops/docs/roadmap/progress.md` or docs.

**Mini Phase 05C - Rules Regression Suite**

- Subtarget: Add fixture-based tests for opening legal moves, capture rules, promotion rules, terminal positions, and notation.
- Subtarget: Include negative tests for illegal moves and malformed input.
- Output: Rules regression tests.

**Verification Gate:** `npm run test -- variants`, `npm run test -- rules`, `npm run typecheck`.

**Commit Gate:** Commit rules work with `phase 05: normalize rules adapters`.

---

## Phase 06: Variant Diversity And Catalog Depth

**Target:** Expand variant diversity while making the catalog easier to browse, compare, and trust.

**Mini Phase 06A - Catalog Taxonomy**

- Subtarget: Group games by family: orthodox, regional, historical, fairy, multiplayer, training, puzzle-like, experimental.
- Subtarget: Add metadata for board shape, player count, complexity, duration, rules confidence, bot support, and analysis support.
- Output: Catalog type updates and tests.

**Mini Phase 06B - Launch Candidate Review**

- Subtarget: Decide which variants are launch-ready, which need rules work, and which belong in a research backlog.
- Subtarget: Avoid presenting unsupported variants as fully playable.
- Output: Catalog status updates.

**Mini Phase 06C - Discovery UI**

- Subtarget: Improve filters, search, variant cards, and comparison surfaces.
- Subtarget: Make catalog pages useful for both new players and variant experts.
- Output: UI and accessibility tests for filtering and navigation.

**Verification Gate:** `npm run test -- catalog`, `npm run audit:live`, `npm run build`.

**Commit Gate:** Commit catalog work with `phase 06: deepen variant catalog`.

---

## Phase 07: Board Interaction And Move UX

**Target:** Make playing a move feel precise, understandable, and consistent across mouse, touch, and keyboard.

**Mini Phase 07A - Input Modes**

- Subtarget: Support click-click, drag-drop, touch selection, keyboard focus movement, promotion selection, and cancel move.
- Subtarget: Ensure all modes share the same legal move validation path.
- Output: Component tests and Playwright checks.

**Mini Phase 07B - Board Feedback**

- Subtarget: Show selected square, legal destinations, last move, check, premove candidate where applicable, captured pieces, and game result.
- Subtarget: Keep visual states readable in light and dark themes.
- Output: Screenshot-reviewed board states.

**Mini Phase 07C - Variant Board Shapes**

- Subtarget: Verify non-8x8 boards render correctly with stable square sizing and responsive constraints.
- Subtarget: Prevent labels, pieces, and controls from overlapping on mobile.
- Output: Playwright checks for representative variants.

**Verification Gate:** `npm run test -- game-board`, `npm run audit:live`, `npm run build`.

**Commit Gate:** Commit board UX work with `phase 07: improve board interactions`.

---

## Phase 08: Information Architecture And Navigation Workflow

**Target:** Make the app easy to understand and efficient to move through.

**Mini Phase 08A - Route Intent Review**

- Subtarget: Confirm each route has a clear job and a clear next action.
- Subtarget: Remove duplicated navigation choices and dead-end pages.
- Output: Route purpose table in `ops/docs/roadmap/progress.md`.

**Mini Phase 08B - Navigation States**

- Subtarget: Ensure active states, locale switching, theme switching, auth state, and mobile navigation are consistent.
- Subtarget: Add tests for route highlighting and locale-safe links.
- Output: Navigation tests and UI updates.

**Mini Phase 08C - Task-Oriented Workflows**

- Subtarget: Optimize common flows: start a game, resume a game, analyze a game, practice against bot, find a variant, join lobby, review history.
- Subtarget: Reduce unnecessary page jumps.
- Output: Playwright flows for top tasks.

**Verification Gate:** `npm run test -- navigation`, `npm run test:e2e`, `npm run audit:live`.

**Commit Gate:** Commit navigation work with `phase 08: streamline navigation workflows`.

---

## Phase 09: Visual Design System And Responsive Polish

**Target:** Establish a restrained, durable UI system that fits a serious chess product and scales to dense workflows.

**Mini Phase 09A - Design Tokens**

- Subtarget: Audit colors, spacing, typography, borders, focus rings, z-index, and motion.
- Subtarget: Reduce one-off styling and document token usage.
- Output: CSS cleanup and visual notes in `ops/docs/roadmap/decisions.md`.

**Mini Phase 09B - Component Consistency**

- Subtarget: Align buttons, icon buttons, menus, tabs, forms, cards, modals, tables, filters, and empty states.
- Subtarget: Use lucide icons for recognizable tool actions.
- Output: Component updates with focused tests.

**Mini Phase 09C - Responsive Layout Pass**

- Subtarget: Verify mobile, tablet, desktop, and wide desktop layouts for all major pages.
- Subtarget: Ensure text never overflows controls or overlaps adjacent content.
- Output: Playwright screenshots or audit notes.

**Verification Gate:** `npm run audit:live`, `npm run test:e2e`, `npm run build`.

**Commit Gate:** Commit design work with `phase 09: polish visual system`.

---

## Phase 10: Accessibility And Internationalization

**Target:** Make AllChess usable across input methods, assistive technology, and supported launch locales.

**Mini Phase 10A - Accessibility Baseline**

- Subtarget: Audit keyboard navigation, focus visibility, landmarks, labels, dialogs, menus, color contrast, and screen reader announcements.
- Subtarget: Fix critical blockers before cosmetic issues.
- Output: Accessibility issue list in `ops/docs/roadmap/progress.md`.

**Mini Phase 10B - I18n Completeness**

- Subtarget: Check all visible UI strings for dictionary coverage.
- Subtarget: Verify locale-safe routes and variant terminology across 19 launch locales.
- Output: I18n tests and dictionary updates.

**Mini Phase 10C - Locale Layout Stress Test**

- Subtarget: Test long-language strings in compact nav, buttons, cards, forms, history rows, and board side panels.
- Subtarget: Add wrapping or responsive constraints where needed.
- Output: Browser audit notes and CSS fixes.

**Verification Gate:** `npm run test:i18n`, `npm run audit:live`, `npm run typecheck`.

**Commit Gate:** Commit accessibility/i18n work with `phase 10: improve accessibility and locales`.

---

## Phase 11: Auth, Profiles, And Account Workflow

**Target:** Make identity flows complete, secure, and pleasant without overcomplicating launch.

**Mini Phase 11A - Auth Flow Audit**

- Subtarget: Verify guest mode, email/password, session persistence, logout, and protected routes.
- Subtarget: Confirm passkey and Google OAuth hooks are represented accurately in UI and docs.
- Output: Auth gap list and tests.

**Mini Phase 11B - Profile Completeness**

- Subtarget: Define profile fields, privacy settings, rating display, variant history, and account preferences.
- Subtarget: Ensure public profile data is intentionally limited.
- Output: Profile model decisions in `ops/docs/roadmap/decisions.md`.

**Mini Phase 11C - Settings Workflow**

- Subtarget: Wire preferences for theme, locale, board style, move input, notifications, privacy, and analysis defaults.
- Subtarget: Persist settings consistently for guest and signed-in users.
- Output: Settings tests and UI flow.

**Verification Gate:** `npm run test -- auth`, `npm run test -- session`, `npm run audit:env -- cloudflare`.

**Commit Gate:** Commit account work with `phase 11: complete account workflows`.

---

## Phase 12: Realtime Rooms, Lobby, And Matchmaking

**Target:** Make multiplayer discovery and live game state dependable.

**Mini Phase 12A - Room Lifecycle**

- Subtarget: Define room states: open, matched, active, completed, cancelled, expired.
- Subtarget: Ensure Durable Object state and D1 state cannot drift silently.
- Output: Room lifecycle tests.

**Mini Phase 12B - Matchmaking Rules**

- Subtarget: Match by variant, time control, rating band, region preference, and bot fallback preference.
- Subtarget: Add clear failure states when no match is available.
- Output: Matchmaking tests.

**Mini Phase 12C - Presence And Recovery**

- Subtarget: Handle reconnect, duplicate tabs, abandoned games, spectators, and watch page updates.
- Subtarget: Define when the app retries versus asks the user to refresh.
- Output: Realtime and Playwright tests.

**Verification Gate:** `npm run test -- realtime`, `npm run test:e2e`, `npm run build`.

**Commit Gate:** Commit realtime work with `phase 12: harden realtime rooms`.

---

## Phase 13: Bot System, Difficulty, And Training Workflow

**Target:** Make bots credible, calibrated, and transparent across supported variants.

**Mini Phase 13A - Bot Capability Matrix**

- Subtarget: Track which variants use Stockfish, external engines, generated knowledge, or internal search.
- Subtarget: Report limitations clearly in API and UI.
- Output: Capability matrix and tests.

**Mini Phase 13B - Difficulty Calibration**

- Subtarget: Verify Easy, Normal, Hard, Very Hard, Grandmaster, and Legend behavior against measurable targets.
- Subtarget: Separate response speed, search depth, randomness, and blunder rate controls.
- Output: Benchmark tests and calibration notes.

**Mini Phase 13C - Training Pipeline Reliability**

- Subtarget: Make generated knowledge reproducible and cache-friendly.
- Subtarget: Add checks that generated files are deployable and not accidentally oversized.
- Output: Training script tests and docs.

**Verification Gate:** `npm run test -- bots`, `npm run bots:train:data`, `npm run test -- bot`.

**Commit Gate:** Commit bot work with `phase 13: calibrate bot system`.

---

## Phase 14: Analysis, Review, And Learning Functions

**Target:** Make post-game review useful, explainable, and connected to practice.

**Mini Phase 14A - Analysis Contract**

- Subtarget: Standardize analysis input: game id, moves, variant, position history, player perspective, and requested depth.
- Subtarget: Standardize output: evaluation, mistake labels, alternatives, annotations, and confidence.
- Output: API contract tests.

**Mini Phase 14B - Review UI**

- Subtarget: Support move timeline, board replay, engine or AI comments, mistake navigation, and exportable summary.
- Subtarget: Keep unsupported variants honest with graceful fallback messages.
- Output: Review UI tests and Playwright flow.

**Mini Phase 14C - Practice From Mistakes**

- Subtarget: Convert reviewed mistakes into replayable practice positions.
- Subtarget: Track whether the user solved the position on retry.
- Output: Practice integration tests.

**Verification Gate:** `npm run test -- analysis`, `npm run audit:live`, `npm run build`.

**Commit Gate:** Commit review work with `phase 14: deepen game analysis`.

---

## Phase 15: Practice, Lessons, And Skill-Building Workflow

**Target:** Turn practice from a page into a structured improvement loop.

**Mini Phase 15A - Practice Modes**

- Subtarget: Define modes for tactics, endgames, openings, variant rules, bot sparring, and reviewed mistakes.
- Subtarget: Keep mode selection fast and scannable.
- Output: Practice mode model and tests.

**Mini Phase 15B - Progress Tracking**

- Subtarget: Track attempts, streaks, accuracy, difficulty, variant, and time spent.
- Subtarget: Avoid collecting unnecessary personal data.
- Output: Persistence tests and privacy decision.

**Mini Phase 15C - Lesson Content Structure**

- Subtarget: Define reusable lesson metadata: title, variant, objective, prerequisite, positions, hints, completion rule.
- Subtarget: Add starter content for core chess and at least two regional variants.
- Output: Content fixtures and UI coverage.

**Verification Gate:** `npm run test -- practice`, `npm run test:e2e`, `npm run build`.

**Commit Gate:** Commit practice work with `phase 15: build practice workflow`.

---

## Phase 16: Persistence, D1 Schema, And Data Integrity

**Target:** Ensure stored games, users, moves, rooms, ratings, analysis, and preferences remain consistent as features grow.

**Mini Phase 16A - Schema Review**

- Subtarget: Audit migrations for games, moves, rooms, ratings, profiles, sessions, and analysis reports.
- Subtarget: Verify indexes match expected queries.
- Output: Schema notes and migration decisions.

**Mini Phase 16B - Repository Contracts**

- Subtarget: Ensure each D1 repository has tests for create, read, update, conflict, not found, and malformed input behavior.
- Subtarget: Keep SQL isolated from UI and route-level concerns.
- Output: Repository tests.

**Mini Phase 16C - Migration Safety**

- Subtarget: Add a repeatable local migration verification process.
- Subtarget: Record rollback or forward-fix expectations for production migrations.
- Output: Migration checklist in docs.

**Verification Gate:** `npm run db:migrate:local`, `npm run test -- d1`, `npm run test -- cloudflare`.

**Commit Gate:** Commit persistence work with `phase 16: harden data integrity`.

---

## Phase 17: Performance, Bundle Health, And Runtime Efficiency

**Target:** Keep the app fast under real product complexity.

**Mini Phase 17A - Frontend Performance Audit**

- Subtarget: Measure route load, interaction latency, board rendering, catalog filtering, and analysis replay.
- Subtarget: Identify expensive client components and unnecessary hydration.
- Output: Performance notes and targeted fixes.

**Mini Phase 17B - Bundle And Asset Review**

- Subtarget: Check dependency weight, dynamic import opportunities, generated data size, and Stockfish asset handling.
- Subtarget: Keep large assets out of critical first load unless required.
- Output: Bundle improvements and tests.

**Mini Phase 17C - Backend Runtime Efficiency**

- Subtarget: Review API route CPU time, D1 query count, R2 access patterns, Durable Object message volume, and AI provider calls.
- Subtarget: Add caching or batching only where measurement shows a need.
- Output: Runtime notes and regression tests.

**Verification Gate:** `npm run build`, `npm run audit:live`, `npm run test -- performance`.

**Commit Gate:** Commit performance work with `phase 17: improve runtime performance`.

---

## Phase 18: Security, Privacy, And Abuse Resistance

**Target:** Protect accounts, games, data, and infrastructure before public growth.

**Mini Phase 18A - Secret And Environment Audit**

- Subtarget: Verify `config/env/.env.example`, docs, Wrangler config, Vercel config, and audit scripts list the right variables without exposing secrets.
- Subtarget: Confirm broad tokens are not present in source, logs, or committed files.
- Output: Env audit notes.

**Mini Phase 18B - Input And Authorization Review**

- Subtarget: Validate route inputs with structured schemas.
- Subtarget: Confirm users can only mutate games, rooms, profiles, and analysis reports they are allowed to access.
- Output: Security tests for unauthorized access and malformed input.

**Mini Phase 18C - Abuse Controls**

- Subtarget: Define rate limits or soft throttles for login, matchmaking, bot requests, analysis requests, and AI provider calls.
- Subtarget: Add logging that helps debug abuse without storing sensitive content unnecessarily.
- Output: Abuse control implementation and docs.

**Verification Gate:** `npm run audit:env -- cloudflare`, `npm run test`, `npm run build`.

**Commit Gate:** Commit security work with `phase 18: strengthen security posture`.

---

## Phase 19: Deployment, Observability, And Operations

**Target:** Make deploys predictable and production behavior observable.

**Mini Phase 19A - Cloudflare Deploy Path**

- Subtarget: Verify OpenNext build, Worker deploy, D1 bindings, R2 buckets, Durable Objects, and cache configuration.
- Subtarget: Keep Vercel as hosting only when used, with data remaining on Cloudflare.
- Output: Deployment doc updates.

**Mini Phase 19B - Operational Checks**

- Subtarget: Add health checks for catalog, live stats, rules endpoint, bot model endpoint, D1 connectivity, and object storage where appropriate.
- Subtarget: Define what a healthy response means.
- Output: Operational tests or scripts.

**Mini Phase 19C - Release Runbook**

- Subtarget: Document pre-release verification, deploy commands, post-deploy smoke tests, rollback or forward-fix process, and incident notes.
- Subtarget: Include Windows PowerShell-compatible commands.
- Output: Release runbook in docs.

**Verification Gate:** `npm run verify`, `npm run cf:build`, `npm run audit:env -- cloudflare`.

**Commit Gate:** Commit operations work with `phase 19: complete deploy runbook`.

---

## Phase 20: Completeness Review And Launch Hardening

**Target:** Confirm the product is coherent, tested, documented, and ready for the next public milestone.

**Mini Phase 20A - Feature Completeness Audit**

- Subtarget: Compare completed work against phases 01 through 19.
- Subtarget: Identify remaining gaps as launch blockers, follow-up improvements, or research backlog.
- Output: Final readiness table in `ops/docs/roadmap/progress.md`.

**Mini Phase 20B - End-To-End Validation**

- Subtarget: Run complete user flows for guest, signed-in player, bot practice, live room, analysis review, variant browsing, settings, and profile.
- Subtarget: Capture failures with route, browser size, locale, and reproduction steps.
- Output: E2E validation notes.

**Mini Phase 20C - Documentation And Release Notes**

- Subtarget: Update README, deployment docs, workflow docs, and change log.
- Subtarget: Write release notes that separate user-visible changes, technical changes, and known limitations.
- Output: Release notes and final commit.

**Verification Gate:** `npm run verify`, `npm run test:e2e`, `npm run audit:live`, `npm run audit:env -- cloudflare`.

**Commit Gate:** Commit launch readiness with `phase 20: finalize improvement roadmap`.

---

## Phase Dependency Map

- Foundation: phases 01, 02, 03.
- Core gameplay: phases 04, 05, 07, 16.
- Product breadth: phases 06, 08, 09, 10, 11, 15.
- Live and intelligence systems: phases 12, 13, 14.
- Production hardening: phases 17, 18, 19, 20.

Recommended execution order is numerical unless a blocker makes a later documentation or audit phase useful first.

## Commit And Tracking Rules

- Use one commit per mini phase when implementation is meaningful; combine tiny documentation-only updates when they are part of the same tracking change.
- Include the phase number in commit messages.
- Update `ops/docs/roadmap/progress.md` before each commit.
- Update `ops/docs/roadmap/change-log.md` after behavior, UI, architecture, docs, or workflow changes.
- Update `ops/docs/roadmap/decisions.md` whenever a choice affects future implementation direction.
- Never mark a phase complete without a verification note.
