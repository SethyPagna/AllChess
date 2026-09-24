# Cambodia, friend play, and web-app continuation

## Delivered

- Cambodia has its own `ouk-chaktrang` variant and home card, native Khmer name, asymmetric royal setup, opening leaps, permanent king-leap restrictions, sixth-rank promotion, plain board, piece names, and an original SVG collection. The catalog now has 21 board adapters, with Cambodia explicitly in local/bot preview while competitive verification is unfinished. Published digital counting and three teaching positions are now implemented; see `ouk-counting-profile.md`.
- Original Higgsfield/Blender collection: six carved shapes in two materials. The editable `.blend`, portable `.glb`, and rendered preview are committed with provenance in `ops/assets/khmer/README.md`. Optional interactive 3D supports tapping moves, orbiting, zooming, board rotation, and themes. It loads only on demand, remembers the view, reuses geometry, avoids redraws for clock-only updates, and retains the accessible 2D option.
- Setup uses tactile buttons for clocks and sides, and a disclosure with real choice buttons for long bot/family lists. Appearance uses visual presets. The 2D board has a single tab entry and arrow-key square navigation.
- Friend invites connect two browsers through authoritative room actions: assigned seats, legal moves and drops, server clocks, agreed draws, resignation, rejoining, spectator views, and private player messages. Snapshots have monotonically increasing revisions so slower responses cannot overwrite newer state.
- Production rooms use the existing `GAME_ROOM_DO` binding, serialized storage transitions, hashed seat credentials, and seven-day expiry with a storage alarm. The bounded in-memory fallback is restricted to development/test. Production without the binding returns unavailable instead of pretending a local room is online.
- Installable manifest, regular/maskable icons, browser install prompt, and an offline reconnect page. The service worker caches only public fallback assets; it does not cache private pages, APIs, room state, or account information.

## Validation

- Lint, TypeScript, and production build (208 generated pages).
- 395 unit/domain/API cases covered across the full run and targeted reruns. A CPU-sensitive bot deadline check exceeded its 2.8-second bound when run alongside browser/lint work; it passed in isolation. The previous isolated 53-case bot run also passed. Do not describe this as a clean, simultaneous stress/performance pass.
- Six existing browser scenarios pass, including real friend-room creation. The high-strength first-bot-reply deadline similarly needed an isolated rerun after concurrent checks.
- Separate desktop host, mobile guest, and spectator contexts exchanged moves, preserved seats after reload, delivered player chat, and agreed a draw, with no runtime errors or horizontal overflow.
- Cloudflare local Wrangler runtime accepted one of twelve simultaneous same-version moves and rejected the other eleven. State and both seat credentials survived a complete runtime restart; the guest then made the next legal move.
- Mobile/home/setup checks at 320, 390, and 1440 pixels; choice dismissal, board keyboard navigation, manifest icons, and offline navigation fallback passed.
- Blender render and browser 2D/3D boards inspected visually; a move made by raycasting on the 3D board appeared correctly when switching to 2D.

One-off audit runners and screenshots are ignored under `output/playwright/`. No production deployment, remote migration, or live Cloudflare validation is included.

## Next acceptance gates for the active goal

1. Complete Cambodia's online/bot verification and separately resolve referee-dependent championship interpretations. Published digital board/piece counting, stop/restart, counters, and draw adjudication are implemented and tested in `ouk-counting-profile.md`. Keep competitive/friend access gated until the remaining verification is complete.
2. Extend distinct 3D collections and camera/view choices to the other game families, keeping their authentic boards, pieces, and accessible 2D rendering. Only Cambodia currently has real 3D assets.
3. Exercise friend flows through the deployed Durable Object binding; add account-based contacts, invitation management, reconnect indicators, and a coordinated rematch. Current invites are bearer links with device-held seat tokens, not an account friends list. Saved account match records and ranked matchmaking still use the existing separate infrastructure.
4. Complete localization of new interface copy, including Khmer, and audit contrast, reduced motion, screen-reader flow, touch gestures, and longer matches across the full catalog.
5. Expand offline capability beyond the reconnect page and already-open local games. Cold-start offline play is not implemented.
6. Audit and complete the remaining guide-only games individually. A catalog listing is not evidence of a finished rules engine.

The broad goal remains active. This milestone is reviewable progress, not a claim that every game, mode, or production service is perfected.
