# AllChess Decision Log

Record decisions that affect architecture, workflow, product behavior, or release direction. Keep entries short, dated, and actionable.

---

## Decision 0001: Use Root-Level Tracking Files For The Improvement Program

**Date:** 2026-05-16

**Status:** Accepted

**Context:** The improvement program needs visible tracking for a 20-phase roadmap, progress, decisions, and completed changes. The requested names included `plan.md` and `progress.md`.

**Decision:** Keep the initial tracking system at the repository root with `plan.md`, `progress.md`, `decisions.md`, and `change-log.md`.

**Consequences:**

- The roadmap is easy to find without searching inside docs folders.
- Future long-form research can still move into `docs/` and link back from the root files.
- Every implementation phase has a clear place to update status and rationale.

---

## Decision 0002: Keep AllChess Cloudflare-First

**Date:** 2026-05-16

**Status:** Accepted

**Context:** Existing README and deployment docs describe AllChess as Cloudflare-first, with D1, R2, Durable Objects, and OpenNext as core runtime infrastructure.

**Decision:** The 20-phase plan keeps Cloudflare as the primary runtime and data platform. Vercel remains a hosting path only when used; persistent data stays in Cloudflare resources.

**Consequences:**

- Deployment, persistence, realtime, storage, and operations phases target Cloudflare first.
- New data features must consider D1 migrations and repository tests.
- New realtime features must consider Durable Object state and recovery behavior.

---

## Decision 0003: Treat Variant Support As A Capability Matrix

**Date:** 2026-05-16

**Status:** Accepted

**Context:** AllChess aims to support classic chess and global variants, but not every variant can honestly ship with the same quality of rules, bots, notation, analysis, and UI support at once.

**Decision:** Variant work should track support level by capability: playable rules, notation, bot support, analysis support, review support, catalog confidence, and localization confidence.

**Consequences:**

- The catalog should not imply full support for research-stage variants.
- Rules, bot, and analysis phases can advance independently while still exposing truthful UI states.
- Launch readiness can be evaluated per variant instead of as one all-or-nothing milestone.
