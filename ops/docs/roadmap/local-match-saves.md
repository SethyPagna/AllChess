# Saved local matches

Local and bot games save automatically on this device. **Saved games** in the home library, game setup, or offline studio opens the saved collection. New games keep previous records. Completed games can reopen for review. Removing a save requires its explicit Remove action; unreadable records are retained so a failed restore never silently deletes a game.

Resume preserves the current board, undo and redo positions, move notation, clocks/increments, side/orientation, bot mode/difficulty, captures, hands, promoted pieces, and variant state. This includes Cambodia's opening rights, exercises and counting claims, Shogi repetition/impasse data, and multi-capture continuations. The view and piece material still use the existing per-game appearance preferences.

Local games pause when the document is hidden. Pausing cancels an outstanding bot request, and local clocks do not accrue time while closed or paused. A saved-game link restores a paused board and waits for **Resume game**; an in-place Resume button starts that save. Online room clocks continue to be server-authoritative and are not included in local saves.

## Persistence and recovery

- IndexedDB database `allchess-local-matches`, schema version 1, stores one transactional record per game ID. No accounts, room credentials, online/spectator snapshots, or chat messages are included.
- A compact data table shares repeated board cells, pieces and rule metadata across snapshots. The longest move line is stored once. Restoration does not replay moves and therefore cannot erase out-of-band counting claims or overwrite a saved clock.
- Moves, results, counting actions, undo/redo and settings changes trigger writes. Clock-only checkpoints run every five seconds, with an additional flush when hiding/leaving. The Saved indicator appears after transaction completion. Unchanged payloads do not advance the revision or the list's timestamp.
- The expected revision is checked in the same read/write transaction as the update. A stale window cannot overwrite a newer record. It pauses and offers **Open latest save** or **Keep this board as a copy**, which saves under a new ID. Delete actions also check the revision.
- Quota/storage failures preserve the previous committed record and leave the open board playable, with Retry save. A sudden process or device failure can still lose a write that has not committed; clock checkpoints may lag by up to five seconds.
- Decoding checks the format/version, reference graph, board dimensions and coordinates, players, clocks, modes, chronology and game identity. Unsupported/corrupt records fail cleanly. The current format bounds saves to 2,048 timeline positions, 4,096 moves and a 4 MiB encoded payload. The picker shows the 100 most recently updated matching records; it does not delete older records.

## Validation

The full 63-file unit/domain/API suite passed all 496 cases. After adding an encode-time timeline limit, all 28 saved-match cases passed in a focused rerun (497 unique passing cases across these runs). The every-game/every-difficulty bot sweep is now parameterized by game, retaining all searches and assertions while removing a single aggregate two-minute timeout.

Twenty-eight unit tests exercise all 21 native board adapters across moves and undo/redo, compare legal moves before/after restoration, retain Cambodia's counted ending and opening restrictions, retain Shogi promotion and a legal drop, preserve a mandatory draughts continuation, retain castling restrictions and en-passant availability, preserve completed results, check long-timeline compaction, reject invalid saves, and refuse an oversized timeline before it can overwrite a readable record.

Real browser audits verify ordinary reload/resume, undo/redo after reload, saved clock values while paused and after restoration, the home library, two-window conflict detection with both branches retained, a simulated storage quota failure and retry, corrupt-record retention, explicit removal, bot continuation with the saved side, and friend-room exclusion. A persistent production Chrome profile downloaded the offline pack, saved a Cambodian counted ending in 3D, closed, reopened offline, restored its count/view, and continued moves plus undo/redo. A second cold offline profile restored an available en-passant capture, completed it, and used undo/redo; unchanged untimed saves kept their existing revision across periodic checkpoints. Runtime errors were empty. Desktop and mobile layouts were inspected. Final lint, TypeScript, and production build passed (209 pages; 83 verified offline assets, 22.0 MiB).

These are device-local records. [Portable export/import](saved-game-transfer.md) is now implemented. Account synchronization, physical-device browser validation, and localization of the new controls remain separate acceptance gates. No production deployment is included.

The restoration checks also exposed missing en-passant support in the shared rules engine. The engine now removes the adjacent pawn, expires the right after one reply, rejects king-exposing captures, awards Crazyhouse pocket material, and treats it as a mandatory capture in Antichess. Bot position-cache keys now distinguish the previous move and home-square movement rights, with two regression checks. Ten focused rules tests cover both colors and applicable variants, including the Horde first-rank exclusion. Rule references: [FIDE Laws of Chess, article 3.7.3](https://handbook.fide.com/chapter/e012023) and [Lichess Horde rules](https://lichess.org/variant/horde).
