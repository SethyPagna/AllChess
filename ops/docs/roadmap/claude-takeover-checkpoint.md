# Rules and compact interface checkpoint

The September 29 takeover preserves Claude's integrated rules and page redesign work on `codex/compact-game-studio`.

## Included

- Compact home, catalog, game setup, play, community, account and navigation layouts.
- Local saved matches in History, game-detail favorites, promotion timeout protection and canonical game aliases on import.
- Draughts capture rules, end conditions, move kinds and notation, bot timeout recovery, Horde setup, Janggi palace diagonals, Western repetition and Shogi royal-piece corrections.

## Fresh checks

- Complete unit suite: **1,327 tests / 112 files passed**.
- Full lint: passed without diagnostics.
- Final production TypeScript check and Cloudflare packaging: in progress.

## Integrated follow-up

- Hints preserve complete move requests, including drops, passes and underpromotion, and reject stale positions. Janggi has a compact Pass action, subject to normal turn and room permissions.
- Shatranj handles stalemate and bare-king replies, while historical saves retain their opening layout. Shogi and Mini Shogi lose when no legal move or drop exists. Kōnane checks the end condition after the opening removals.
- Xiangqi and Janggi adjudicate repetition/perpetual check under the documented profile. Compact repetition records remain compatible with earlier saves. Full WXF perpetual chasing remains unimplemented.
- Capture chains earn one increment at the end of the turn. Production legacy move endpoints are retired; seat-authorized friend rooms remain available.
- Cloudflare now bundles the actual realtime source into the OpenNext worker. Real local workerd tests exercise friend seats and moves, Quick Match provisioning, legacy rejection and the generated socket bridge.
- Root and organized Wrangler configs resolve the same worker/assets and OpenNext cache binding.

These changes initially passed **91 focused tests**, a separate **six-case deployment configuration suite**, TypeScript and targeted lint. The complete unit and lint gates above now cover the combined implementation; final build and browser verification remain pending.

## Bot and copy follow-up

The integrated bot candidate passes **109 focused tests** against the current rules engine. It includes legal hand drops and Janggi passes, consistent root scoring, promotion safety, clock-aware search and an expired-budget fallback. New regressions cover 49 legal Shogi interpositions and low-clock behavior. King of the Hill explanations reuse verified search evidence instead of opening new analysis budgets after the deadline. The two cache-correctness tests use compact positions and a controlled clock; existing real-time timing and safety assertions are unchanged. The final Jungle den-win priority repair passes **120 focused bot/profile tests** and the complete suite above; the shortcut also preserves legal hill wins.

Six guide phrases now describe rules to players instead of implementation requirements. Their **14 focused tests** pass. Two confirmed unreferenced navigation/picker components are removed; shared stylesheet pruning remains deferred.

Both Wrangler configs now resolve the real D1 migrations directory. Explicit browser-test base URLs skip starting a separate development server, allowing production checks to use the intended target.

## Still in progress

The bot candidate's focused lint/type checks and the complete unit/lint gates pass. Browser tests have been migrated, but need final desktop/mobile runs against the repaired code. Production/Cloudflare builds and final camera/offline checks are in progress. The available Cloudflare login cannot access the account configured for AllChess, so the existing remote failed build log has not been recovered. This does not block local verification.

This is a recovery checkpoint, not a production-readiness or complete-product claim. Private recovery records and snapshots stay outside the repository.
