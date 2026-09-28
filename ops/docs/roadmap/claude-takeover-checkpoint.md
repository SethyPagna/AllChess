# Rules and compact interface checkpoint

The September 29 takeover preserves Claude's integrated rules and page redesign work on `codex/compact-game-studio`.

## Included

- Compact home, catalog, game setup, play, community, account and navigation layouts.
- Local saved matches in History, game-detail favorites, promotion timeout protection and canonical game aliases on import.
- Draughts capture rules, end conditions, move kinds and notation, bot timeout recovery, Horde setup, Janggi palace diagonals, Western repetition and Shogi royal-piece corrections.

## Fresh checks

- Unit suite: **1,238 tests / 102 files passed**.
- TypeScript: passed with incremental output disabled.
- Full lint: zero errors; five warnings are confined to an inherited temporary E2E probe, excluded from this checkpoint.

## Integrated follow-up

- Hints preserve complete move requests, including drops, passes and underpromotion, and reject stale positions. Janggi has a compact Pass action, subject to normal turn and room permissions.
- Shatranj handles stalemate and bare-king replies, while historical saves retain their opening layout. Shogi and Mini Shogi lose when no legal move or drop exists. Kōnane checks the end condition after the opening removals.
- Xiangqi and Janggi adjudicate repetition/perpetual check under the documented profile. Compact repetition records remain compatible with earlier saves. Full WXF perpetual chasing remains unimplemented.
- Capture chains earn one increment at the end of the turn. Production legacy move endpoints are retired; seat-authorized friend rooms remain available.
- Cloudflare now bundles the actual realtime source into the OpenNext worker. Real local workerd tests exercise friend seats and moves, Quick Match provisioning, legacy rejection and the generated socket bridge.
- Root and organized Wrangler configs resolve the same worker/assets and OpenNext cache binding.

These integrated changes pass **91 focused tests**, a separate **six-case deployment configuration suite**, TypeScript and targeted lint. Full combined gates and browser verification remain pending.

## Still in progress

Bot drop/pass repairs, search strength and clock handling are under independent review. Browser test migration, full production build and final browser/offline checks are pending. The available Cloudflare login cannot access the account configured for AllChess, so the existing remote failed build log has not been recovered. This does not block local verification.

This is a recovery checkpoint, not a production-readiness or complete-product claim. Private recovery records and snapshots stay outside the repository.
