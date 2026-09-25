# Portable saved games

**Export game** on an open local/bot board downloads its current position and full undo/redo timeline, even when device storage cannot save. **Saved games** also offers an export action for each stored match and an **Import game** button, including on an empty device. The same controls work in the downloaded offline studio.

An `.allchess.json` file carries versioned game data: board positions, promotions, hands, captured pieces, clocks, move history, local/bot settings, and regional rule metadata. Cambodian and Makruk counting, Shogi repetition, draughts capture continuation and Janggi opening choices survive without replaying or resetting the game. Appearance uses the receiving device's existing per-game preferences. Room seats, tokens, chat, accounts and online modes are not part of this format.

Every import gets a new game ID in all timeline frames and commits through the existing revision-checked IndexedDB transaction. Importing the same file twice creates two separate games. The file's original ID cannot replace an existing save. The success message links to the correct game, even when importing from another variant's setup panel. Opening that link restores a paused board. A failed import leaves the collection unchanged.

## Format boundaries

The external envelope is `allchess-save`, version 1, with an export timestamp and one game containing its identity, variant key and existing packed save payload. It is an AllChess backup, not a PGN converter or account synchronization service. The file limit is 16 MiB in UTF-8, checked before reading the selected file and again before decoding. Existing timeline/payload bounds remain in force. Import checks mode support, game identity, dimensions, chronology, player ownership, supported pieces including promoted draughts kings, move coordinates and directly consumed counting/repetition metadata. It rejects damaged or unsupported files without silently removing their rule information.

The codec also limits the reference graph's expanded size to 64 MiB, both before writing a save and before schema validation on decode. This prevents a small shared-reference payload from expanding exponentially during validation or a subsequent save, and prevents the writer from committing a record the reader cannot reopen. Unknown rule metadata remains available for compatibility; imports are local study records, not verified results or ranked evidence.

## Validation

The core suite passes 504 cases across 72 files. Existing all-variant snapshot tests now also exercise portable export/import through real legal timelines, including regional counting, Shogi promotion and drops, draughts continuation, en passant and castling restrictions. Additional tests cover independent imports, Janggi formation/redo retention, all three draughts crowns, invalid versions/identities/modes/pieces, oversized files, malformed counting events and an exponential reference graph. The writer's matching expanded-size limit is covered separately.

Six real desktop/mobile browser scenarios verify a browser download and fresh-device import, both export entry points, cross-variant navigation, repeated imports retaining the original record, paused restoration and redo/undo, damaged-file and storage failure recovery, and export from an unsaved open board. No runtime errors or horizontal overflow appeared. Production lint, TypeScript and build checks pass, with 209 generated pages and 87 public offline assets (24.2 MiB).

A Cambodian counted ending was exported from one production browser. A separate fresh profile downloaded the play pack, closed, and reopened offline at mobile width. It imported the file through the offline studio, restored the paused board and count, used undo/redo, continued both sides through the native 3D tabletop to advance the count, and exported a new backup without a connection. No runtime errors or horizontal overflow appeared.

Account synchronization, full control localization, physical-device testing and deployed-host verification remain open. No production deployment or remote migration is included.
