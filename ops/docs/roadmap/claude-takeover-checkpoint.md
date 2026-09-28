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

## Still in progress

Unmerged bot drop/pass repairs, bot strength and clock handling, additional variant endings/repetition, legacy online route retirement and capture-chain increments remain separate work. The generated Cloudflare worker also needs its authentic friend-room handlers bundled. Browser test migration, full production build and final browser/offline checks are pending. Existing Xiangqi repetition work does not implement full WXF perpetual-chase adjudication.

This is a recovery checkpoint, not a production-readiness or complete-product claim. Private recovery records and snapshots stay outside the repository.
