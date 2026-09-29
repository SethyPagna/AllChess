# Rules and compact interface checkpoint

The September 29 takeover preserves Claude's integrated rules and page redesign work on `codex/compact-game-studio`.

## Included

- Compact home, catalog, game setup, play, community, account and navigation layouts.
- Local saved matches in History, game-detail favorites, promotion timeout protection and canonical game aliases on import.
- Draughts capture rules, end conditions, move kinds and notation, bot timeout recovery, Horde setup, Janggi palace diagonals, Western repetition and Shogi royal-piece corrections.

## Fresh checks

- The expanded lighting suite ran **1,333 tests / 114 files**: 1,331 passed; two organization checks rejected the new bake script's JavaScript extension. After converting it to TypeScript, all 15 organization checks passed. The earlier complete 1,327-test run was also green. The later offline-client repair passes **44 focused checks**, including nine new lifecycle regressions.
- Full lint passed before the final lighting/picker changes; targeted lint of every subsequently changed code file passes without diagnostics.
- Production build, mandatory TypeScript check and Cloudflare packaging: passed, including all 209 generated pages and the bundled realtime worker.
- Offline pack: 178 public assets, 89,101,430 bytes (84.97 MiB), within its 88 MiB download limit.
- Wrangler production deployment dry-run passed at the preceding checkpoint (31,300.54 KiB uncompressed; 3,125.34 KiB gzip), without deployment or account authentication. The latest lighting build also passes full Cloudflare packaging.

## Integrated follow-up

- Hints preserve complete move requests, including drops, passes and underpromotion, and reject stale positions. Janggi has a compact Pass action, subject to normal turn and room permissions.
- Shatranj handles stalemate and bare-king replies, while historical saves retain their opening layout. Shogi and Mini Shogi lose when no legal move or drop exists. Kōnane checks the end condition after the opening removals.
- Xiangqi and Janggi adjudicate repetition/perpetual check under the documented profile. Compact repetition records remain compatible with earlier saves. Full WXF perpetual chasing remains unimplemented.
- Capture chains earn one increment at the end of the turn. Production legacy move endpoints are retired; seat-authorized friend rooms remain available.
- Cloudflare now bundles the actual realtime source into the OpenNext worker. Real local workerd tests exercise friend seats and moves, Quick Match provisioning, legacy rejection and the generated socket bridge.
- Root and organized Wrangler configs resolve the same worker/assets and OpenNext cache binding.

These changes initially passed **91 focused tests**, a separate **six-case deployment configuration suite**, TypeScript and targeted lint. The full and targeted checks above record the later integration results separately. A later offline-routing fix passes **43 routing/deployment/offline-worker tests** and exact-file lint.

## Bot and copy follow-up

The integrated bot candidate passes **109 focused tests** against the current rules engine. It includes legal hand drops and Janggi passes, consistent root scoring, promotion safety, clock-aware search and an expired-budget fallback. New regressions cover 49 legal Shogi interpositions and low-clock behavior. King of the Hill explanations reuse verified search evidence instead of opening new analysis budgets after the deadline. The two cache-correctness tests use compact positions and a controlled clock; existing real-time timing and safety assertions are unchanged. The final Jungle den-win priority repair passes **120 focused bot/profile tests** and the complete suite above; the shortcut also preserves legal hill wins.

Six guide phrases now describe rules to players instead of implementation requirements. Their **14 focused tests** pass. Two confirmed unreferenced navigation/picker components are removed; shared stylesheet pruning remains deferred.

Cold 3D profiling found repeated studio-lighting generation, an unnecessary pre-model render and blocking first-use shader compilation. The scene now loads a [prepared HDR CubeUV atlas](../../assets/materials/studio-room.md) derived from the same Three.js environment, prepares shaders asynchronously and shows readiness after the initial render. Replacement materials acquire cached shaders before retired materials are disposed, avoiding repeated compilation during moves. Preparation follows changes to the scene; unmount and terminal WebGL loss cannot publish stale readiness. Numerical and GPU orientation checks preserve the original lighting; source parameters, reproduction code and license accompany the asset. The service worker allows that exact asset, and a regression rejects arbitrary HDR paths. Optional lighting failure retains direct scene lights. On narrow screens, expanded setup choices now take space in the page so the bottom navigation cannot cover the last option.

Both Wrangler configs now resolve the real D1 migrations directory. Explicit browser-test base URLs skip starting a separate development server, allowing production checks to use the intended target.

## Browser evidence and remaining scope

The migrated app and gameplay-audit specs passed **76/76 desktop/mobile cases** in four clean batches at the earlier production checkpoint. A subsequent full game-flow run passed 31/32; Mini Shogi's second 3D entry exceeded its existing five-second limit. After the shader-resource repair, all **16 affected 3D cases** passed in three clean batches with original assertions and timeouts; the 16 unaffected cases passed in the preceding run. This is coverage across runs, not a fresh single 32-case result. Three additional callbacks pass the deepest mobile Bot choice, optional HDR failure with raycast/camera play, and cleanup/recovery while shader compilation is pending.

The earlier [Celadon production audits](celadon-checkpoint.md) pass preferences, the 36-case 2D matrix, 78 3D appearance cases, five gameplay/recovery cases and a fully closed/reopened offline browser session. Reviewed mobile/desktop captures show physical boards and readable edge coordinates. A local production Worker serves the built application with the actual Durable Objects, D1 and R2 bindings after all nine local database migrations and cache preparation.

Cold-download verification caught Cloudflare's default HTML routing serving the reconnect fallback at `/offline`. Both Wrangler configs now explicitly disable HTML path rewriting; `/offline` matches the pack's shell hash and `/offline.html` remains the separate fallback. The behavioral regression reproduces the original failure and verifies both corrected configs. The complete offline download/restart/gameplay check passes after the fix.

Updating an existing pack then exposed a separate client lifecycle race: a worker change could close the download subscription and replace progress with the previous pack's ready state. Status and download channels are now separate, stale replies are ignored, and updates wait for the current worker to activate. The 30-second preparation limit ends before transfer; slow downloads remain supported. Failed updates retain the previous playable pack and display an error instead of completion copy. Behavioral regressions cover replacement, stale replies, failed preparation, a 180-second transfer and unmount cleanup; final production verification is recorded separately.

The repaired production build successfully updated the same existing profile that failed, requiring its committed cache pointer to match the current manifest. After complete browser shutdown, it reopened with networking disabled before navigation. All 178 entries were present in the active pack, and the 1,488,081-byte HDR matched its verified SHA-256. Native captures for both owners, rotated pointer moves, undo/redo, saved Celadon/Wood/3D/Slate preferences and zoom/orbit/reset worked. Both runs exited cleanly; the cold run recorded no errors, warnings or failed requests. Earlier failed runs remain part of the evidence, not passing results.

At commit `c572194`, Vercel's GitHub check passed. The remote Cloudflare Workers build failed at `b21e733`; its GitHub check contains a build link but no diagnostic detail. Neither the available CLI login nor the connected Cloudflare account includes the account configured for AllChess, so the remote failure's detailed log has not been recovered. The successful local build and preview do not establish successful remote deployment; current head checks belong to the pull request.

Known follow-up copy includes the orthodox stalemate explanation shown for a Shatranj win and the shared insufficient-material explanation; result adjudication and headline are separate. Navigation terminology still needs a native-language pass. Remaining shared CSS/helper cleanup, wider asset coverage and physical-device checks are deferred rather than declared complete. The historical Aiven authorization note is preserved in private recovery records; no current local verification dependency on it was established.

This is a recovery checkpoint, not a production-readiness or complete-product claim. Private recovery records and snapshots stay outside the repository.
