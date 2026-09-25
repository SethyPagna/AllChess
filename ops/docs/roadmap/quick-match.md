# Authoritative Quick Match — 2026-09-25

Quick Match now pairs two players into the same protected room. Previously, only the second queue request learned about the match; the waiting browser did not poll, and the UI could activate a local board without room synchronization. The old public queue also accepted caller-supplied ratings and returned demo tickets without a functioning room service.

## Behavior

- Each search has a random credential. Repeated join requests refresh one ticket, and both players recover the same committed pairing. Queues are partitioned by game and clock.
- Quick Match is casual. Sides are assigned randomly. Server-derived account ratings and verified identity are required before rated matching and rating settlement can be claimed.
- Both seats are reserved by credential digest before the room link is returned. A third browser may watch but cannot occupy either seat. Clocks wait until both assigned players join.
- Matched play uses the existing authoritative room transport for moves, clocks, Makruk honor-count actions, draw agreements, resignations, private chat, rejoining and rematches. The browser saves its seat credential and replaces the URL with the room link.
- Tapping, dragging and 3D selection now use the same human-turn permission check. An opponent's tap is ignored before sending a request; the server independently validates all moves.
- Cancellation uses the search credential, not a public ticket ID. If pairing already committed, cancellation returns the match. If cancellation wins, a short tombstone rejects delayed join requests. Transient connection failures retry the same search.

## Persistence and bounds

`MatchmakingDO` performs one storage transaction per queue transition. Room provisioning happens afterward, outside that transaction, and is idempotent. If provisioning fails, retrying the committed ticket prepares the same room without resetting an existing game. Queue replies strip internal plans and digests. Game/clock partitioning avoids a single global matchmaking bottleneck.

Waiting leases expire after 30 seconds without polling, cancelled searches after one minute, and delivered pairings after ten minutes. A queue holds at most 500 entries; expired entries are pruned during requests and by an alarm. Rooms use the existing seven-day lifetime. Development/test storage is process-local with per-partition and per-room serialization. Production requires both Durable Object bindings and returns an unavailable response otherwise; it does not silently issue demo tickets or fall back to D1 queue rows.

The existing fetch binding adapter is retained for compatibility with the project's runtime. The new queue and provisioning operations use storage transactions rather than holding a concurrency block across network requests. See [Cloudflare storage guarantees](https://developers.cloudflare.com/durable-objects/api/sqlite-storage-api/).

## Verification

- Final lint, standalone TypeScript checking and production build pass (209 generated pages, 87 offline assets, 24.2 MiB). A fresh production offline restart also restored a counted Makruk 3D game and completed it through board moves after the shared input-permission change.
- 474 core cases across 68 files are covered: 473 passed in the broad run, then all 21 focused cases passed after replacing the obsolete demo-queue expectation. The preceding 73-case general bot run remains applicable; no engine/search implementation changed here.
- API/domain cases cover idempotency, opposite seats, cancellation races, lease expiry, game/clock separation, unsupported modes, invalid credentials/origins, production binding failure and failed provisioning retries.
- Desktop/mobile two-browser E2E checks exercise cancel/restart, pairing, client/server seat authority, shared moves, URL/credential recovery and reload. The reusable test is `ops/tests/e2e/quick-match.spec.ts`. A separate browser check performed an actual 3D tabletop move and verified its authoritative state and the opponent’s turn in the other browser.
- A real matched Makruk game followed a legal 69-ply sequence before two browsers started counting, advanced the count, rejoined and accepted the counting draw. No state-injection endpoint was used.
- A local Wrangler runtime paired 20 concurrent searches into ten distinct rooms. After stopping and restarting that runtime with its persisted storage, the original ticket resolved to the original room, the assigned seat remained valid and the game continued from ply one to ply two.

Production deployment and remote verification remain open. Rated play, account-based friend lists, cross-device search recovery, explicit no-show/requeue handling and wider multiplayer load testing remain part of the full app goal. Closing a waiting tab lets its lease expire; closing after pairing leaves a reserved seat, not a substitute opponent.
