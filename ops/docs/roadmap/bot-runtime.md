# Bot runtime investigation

The two previously failing gates are unchanged: the complete classic Elo ladder must finish within 30 seconds, and each reported bot reply must remain below 2,800 ms. The isolated baseline passed both gates on this host, but exposed unnecessary work that increases contention sensitivity.

## Baseline evidence

On 2026-09-27, `npm run test -- ops/tests/domain/bots.test.ts -t "standards-style smoke|lower tiers avoid simple bad trades" --maxWorkers=1 --reporter=verbose` passed 2 tests (71 skipped). The classic ladder took 12.637 seconds; the five-search trade fixture took 4.758 seconds.

An instrumented run measured the existing `structuredClone` calls without changing search inputs or difficulty settings:

| Position / tier | Requested time | Elapsed | Full clones | Time in cloning |
| --- | ---: | ---: | ---: | ---: |
| Initial / easy | 16 ms | 717 ms | 2,582 | 596 ms |
| Initial / hard | 16 ms | 610 ms | 2,582 | 533 ms |
| Queen versus defended pawn / easy | 25 ms | 1,984 ms | 7,299 | 1,820 ms |
| Queen versus defended pawn / normal | 25 ms | 2,774 ms | 7,299 | 2,531 ms |
| Queen versus defended pawn / hard | 40 ms | 2,116 ms | 7,299 | 1,955 ms |

The internal bot deliberately checks immediate wins and terminal replies before ranking candidates. Each legal move probe previously cloned the entire game state, including history, clocks, hands, and all board cells, only to move one piece temporarily while checking king safety. Those probes accounted for most measured runtime. A small requested search time is a depth-search budget, not an exact upper bound on this safety preflight.

## Change

`src/lib/variants/engine.ts` now copies only the outer board, affected rows, and cells touched by a hypothetical royal-safety probe. En passant includes the captured pawn cell; drops include their destination. Attack detection reads the remaining shared position metadata. The public `applyMove` still takes a fully independent snapshot, and no search depth, beam width, tactical preflight, time assertion, or difficulty setting changed.

A matching instrumented run after the change returned the same moves and scores:

| Position / tier | Elapsed before → after | Full clones before → after |
| --- | ---: | ---: |
| Initial / easy | 717 → 124 ms | 2,582 → 460 |
| Initial / hard | 610 → 101 ms | 2,582 → 460 |
| Queen versus defended pawn / easy | 1,984 → 75 ms | 7,299 → 268 |
| Queen versus defended pawn / normal | 2,774 → 69 ms | 7,299 → 268 |
| Queen versus defended pawn / hard | 2,116 → 73 ms | 7,299 → 268 |

The before/after run compared complete state and legal-move SHA-256 digests over eight deterministic plies for all 21 games: every digest matched. Added regression tests exercise all 21 games with recursively frozen source positions and verify legal move generation plus applied-move snapshot isolation. Dedicated frozen-position fixtures cover legal and pinned en passant, a defensive Crazyhouse drop, and Racing Kings' prohibition on giving check.

## Verification

- All 186 tests in seven files passed: `bots`, `royal-safety-probes`, `en-passant`, `variants`, `bot-history`, `makruk-bot`, and `ouk-bot`. This includes the complete bot ladder and 25 new immutability cases.
- In that run, the unchanged classic smoke gate took 3.543 seconds (baseline 12.637 seconds); the five-search trade fixture took 1.154 seconds (baseline 4.758 seconds).
- Scoped ESLint passed for the engine and new regression file. `git diff --check` passed.
- The integrated [Club delivery](club-collections.md) subsequently passed the default full suite (716 cases across 80 files) and the production build. Physical-device verification remains open. The host runs other applications, so absolute timings are indicative. No search strength recalibration is claimed.

Reproduce the focused regression command:

```powershell
npm run test -- ops/tests/domain/bots.test.ts ops/tests/domain/royal-safety-probes.test.ts ops/tests/domain/en-passant.test.ts ops/tests/domain/variants.test.ts ops/tests/domain/bot-history.test.ts ops/tests/domain/makruk-bot.test.ts ops/tests/domain/ouk-bot.test.ts --maxWorkers=1 --reporter=verbose
```

Ignored supporting logs/scripts are under `output/playwright/bot-runtime-*`, `bot-rules-*`, and `bot-timing-baseline.log`.
