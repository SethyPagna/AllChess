# Authoritative Quick Match — 2026-09-25

Quick Match now pairs two players into the same protected room. Previously, only the second queue request learned about the match; the waiting browser did not poll, and the UI could activate a local board without room synchronization. The old public queue also accepted caller-supplied ratings and returned demo tickets without a functioning room service.

## Behavior

- Each search has a random credential. Repeated join requests refresh one ticket, and both players recover the same committed pairing. Queues are partitioned by game and clock.
- Quick Match is casual. Sides are assigned randomly. Server-derived account ratings and verified identity are required before rated matching and rating settlement can be claimed.
- Both seats are reserved by credential digest before the room link is returned. A third browser may watch but cannot occupy either seat. Clocks wait until both assigned players join within a 60-second arrival window. New Janggi matches also require Han then Cho to confirm their opening formations during that window; see [Janggi setup](janggi-formations.md).
- Matched play uses the existing authoritative room transport for moves, clocks, Makruk honor-count actions, draw agreements, resignations, private chat, rejoining and rematches. The browser saves its seat credential and replaces the URL with the room link.
- Tapping, dragging and 3D selection now use the same human-turn permission check. An opponent's tap is ignored before sending a request; the server independently validates all moves.
- Cancellation uses the search credential, not a public ticket ID. If pairing already committed, cancellation returns the match. If cancellation wins, a short tombstone rejects delayed join requests. Transient connection failures retry the same search.

## Arrival and no-shows

A compact arrival panel shows the remaining server time and a Cancel match button. If both players join before the deadline, the panel disappears and play starts once any required opening setup is complete. At the deadline, admission expires before a late join or formation confirmation can start play. Either assigned player can cancel while the room is still waiting. The game ID and seat credential are required; spectators cannot cancel. A cancellation racing with the second arrival or final confirmation either closes admission or receives a conflict because the game already started. It never resigns an active game automatically.

Cancelled and expired admission remain closed after retries, refreshes and late joins. They are stored as room `arrival` metadata; the unplayed board remains waiting with no result or outcome. The UI therefore shows no win, loss, draw, celebration or rematch. “Find another opponent” creates a fresh search credential and preserves the game and clock; “Back to setup” leaves the closed room URL. Offline views hide the stale countdown and offer reconnection.

The arrival deadline is persisted and checked by both room actions and a Durable Object alarm. Starting or closing admission reschedules the single alarm for the original seven-day room expiry. The alarm handler uses a transaction and tolerates repeat execution. Older waiting matched rooms acquire the deadline from their original creation time; existing active games and ordinary friend invites are unaffected. See [Cloudflare alarm semantics](https://developers.cloudflare.com/durable-objects/api/alarms/).

## Persistence and bounds

`MatchmakingDO` performs one storage transaction per queue transition. Room provisioning happens afterward, outside that transaction, and is idempotent. If provisioning fails, retrying the committed ticket prepares the same room without resetting an existing game. Queue replies strip internal plans and digests. Game/clock partitioning avoids a single global matchmaking bottleneck.

Waiting leases expire after 30 seconds without polling, cancelled searches after one minute, and delivered pairings after ten minutes. A queue holds at most 500 entries; expired entries are pruned during requests and by an alarm. Rooms use the existing seven-day lifetime. Development/test storage is process-local with per-partition and per-room serialization. Production requires both Durable Object bindings and returns an unavailable response otherwise; it does not silently issue demo tickets or fall back to D1 queue rows.

The existing fetch binding adapter is retained for compatibility with the project's runtime. The new queue and provisioning operations use storage transactions rather than holding a concurrency block across network requests. See [Cloudflare storage guarantees](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).

## Verification

- Final lint, standalone TypeScript checking and production build pass (209 generated pages, 87 offline assets, 24.2 MiB). A fresh production offline restart also restored a counted Makruk 3D game and completed it through board moves after the shared input-permission change.
- 482 core cases across 69 files pass in the full core run, including arrival deadline boundaries, clock preservation, spectator/stale rejection and both orderings of join/cancel races. The preceding 73-case general bot run remains applicable; no engine/search implementation changed here.
- API/domain cases cover idempotency, opposite seats, cancellation races, lease expiry, game/clock separation, unsupported modes, invalid credentials/origins, production binding failure and failed provisioning retries.
- Desktop/mobile two-browser E2E checks exercise cancel/restart, pairing, client/server seat authority, shared moves, URL/credential recovery and reload. The reusable test is `ops/tests/e2e/quick-match.spec.ts`. A separate browser check performed an actual 3D tabletop move and verified its authoritative state and the opponent’s turn in the other browser.
- A real matched Makruk game followed a legal 69-ply sequence before two browsers started counting, advanced the count, rejoined and accepted the counting draw. No state-injection endpoint was used.
- A local Wrangler runtime paired 20 concurrent searches into ten distinct rooms. After stopping and restarting that runtime with its persisted storage, the original ticket resolved to the original room, the assigned seat remained valid and the game continued from ply one to ply two.

- Four additional desktop/mobile E2E cases in `ops/tests/e2e/match-arrival.spec.ts` verify cancellation, reload, fresh pairing, the real 60-second expiry, offline/reconnect handling, unchanged clocks and return to setup.
- Twelve concurrent join/cancel races against a local Wrangler runtime produced six started games and six cancelled admissions, with no contradictory state. A separate pending room survived a runtime restart before its deadline; a read-only storage inspector confirmed the alarm expired admission afterward without any public room polling or clock charge. The inspector was confined to the local test harness.

Production deployment and remote verification remain open. Rated play, account-based friend lists, cross-device search recovery and wider multiplayer load testing remain part of the full app goal. Closing a queued tab lets its lease expire. A paired player who never arrives causes the 60-second admission deadline to expire; no substitute is silently inserted. Disconnecting after joining uses the normal active-game clock and reconnection rules.
