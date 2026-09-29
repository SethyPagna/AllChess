# 3D startup and bot deadlines

Checkpoint: 30 September 2026. The broader redesign remains in progress.

## Changes

- Request the selected GLB when the player switches to 3D, overlapping model delivery with viewer JavaScript. Players staying in 2D do not download a GLB.
- Reuse the board and its materials when existing textures finish loading. Replacement board artwork still rebuilds the surface, and lighting changes still invalidate shader preparation. Readiness still follows an actual render.
- Before exploring a Western promotion, use a bounded part of the existing quick-search allocation to check one already-scored alternative. If the promotion's safety check cannot finish, retain a previously verified safe move. Unknown safety is not treated as a completed proof, and no deadline is extended.

The rendering change is commit `2762783`. Artwork, geometry, texture resolution, camera settings and shadows are unchanged.

## Rendering verification

The complete Cloudflare production build passes, including strict TypeScript, 209 generated pages, offline packaging and the realtime Worker. All 33 focused scene tests and scoped lint pass. The 182-file offline pack totals 83,510,451 bytes; all 104 artwork, model, engine and icon descriptors are unchanged from the preceding pack.

Fresh Chrome 153 contexts at 390 × 844 verified the selected model, no GLB requests while in 2D, and actual rendered boards. Shogi Hori and Kōnane Shore also passed native surface/lighting delivery, a single model body transfer, zoom/reset, and unchanged positions after returning to 2D.

| Case | Local production server | Readiness | Five-second target |
| --- | --- | ---: | --- |
| Classic before this change | Wrangler | 7,422 ms | Fail |
| Classic after this change | Next standalone | 16,666 ms | Fail |
| Shogi Hori after this change | Next standalone | 4,940 ms | Pass |
| Kōnane Shore after this change | Next standalone | 10,590 ms | Fail |

These are not paired speed comparisons: the backend changed after a post-build Wrangler navigation timeout and substantial host memory pressure. In the standalone Classic run, the selected GLB began 18 ms after the click, transferred once, and finished about 11.2 seconds after the click. The remaining startup delay is unresolved. Diagnostic waits beyond five seconds preserve the failed timing result even when functional checks subsequently pass. No post-change cold-offline certification is claimed here.

## Bot verification

A new deterministic regression keeps the real rules engine and the original 200 ms request. It advances the clock to the deadline immediately after applying the root queen promotion. The fixture independently proves a safe pawn move exists and that the promotion permits an actual opposing rook mate.

The regression fails before the repair and passes afterward. It requires the promotion and deadline trigger to occur, then independently verifies legality and absence of an immediate winning reply. The three existing bot files report 101 passes and one known failure: normal difficulty still fails to reduce King of the Hill's immediate objective threats in its 80 ms fixture. Promotion, drop, clock and expired-search checks pass in that run, including the positive promotion case.

The safety repair is cooperative: one synchronous engine operation can cross a clock checkpoint. If no safe move was proved before expiry, a legal but unverified fallback remains possible. This is not a guarantee of strict wall-clock completion or universal mate avoidance.

The previous full-suite result remains 1,362 passed, 14 failed and 4 skipped; the focused run does not replace it. Collection expansion, startup performance, remaining bot failures, physical-device checks and hosted Cloudflare verification remain open.
