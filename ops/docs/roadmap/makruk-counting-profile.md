# Makruk honor counting — 2026-09-25

New Makruk games use `makrukProfile: honor-v1`. Unversioned saved games retain the previous automatic counter and identify that policy in the play panel. Cambodian counting remains a separate profile.

## Rules and timing

The source is the [published PyChess Makruk counting profile](https://www.pychess.org/variants/makruk), accessed 2026-09-25. With no unpromoted pawns, a disadvantaged player may claim board honor: start at one, stop or restart, and count only their own moves. The opponent may accept a draw. Giving mate without stopping one's board count draws.

A bare king with no unpromoted pawns automatically triggers piece honor, replacing board honor. Start at the number of remaining pieces plus one. Use the shortest material limit: two rooks 8, one rook 16, two Khon 22, two knights 32, one Khon 44, otherwise 64. Captures never reset or extend this limit. The game draws when the count exceeds the limit.

The implementation explicitly stores a pending first count. Eligibility is established after the triggering move; the next escaping move announces the starting number, then subsequent escaping moves increment it. The two-rook exercise therefore announces 5, 6, 7, 8 and draws at 9. This timing is part of this versioned digital profile; tournament/referee variations remain a validation gate.

## Integration

Local play exposes start, stop and accept buttons only when relevant. Three small exercises cover a bare king, board claims and stopping before mate. Selecting a clock preserves the chosen exercise. Bots claim when materially disadvantaged and stop their board count before an immediate winning move. Static opening knowledge is bypassed while a count is active.

Friend rooms validate seat ownership, game ID, move version and count-event version. Claims do not consume a turn or earn clock increment; elapsed time still charges the player to move. Current clients include the count version with moves. The optional move field preserves compatibility with older clients; count actions require it. Manual events replay into historical review frames. Spectators cannot claim. Both phases, pending counts and events round-trip through local saves and undo/redo.

## Verification

- Lint and the final production build pass, including TypeScript, 209 generated pages and 87 offline assets (24.2 MiB).
- Core coverage is 467 cases across 67 files: the broad run passed 465, followed by a passing 23-case focused rerun including two additional clock/replay regressions. The separate general bot suite passed 73 cases.
- Local browsers verified count progression, fixed limits, stop/restart, counter-mate draws, bot play, undo/redo and mobile layout.
- Two independent browsers joined a real friend room after a legally played 69-ply sequence. They verified ownership, count progression, rejoining and accepting the counting draw. No state-injection endpoint was used.
- A fresh production Chrome profile downloaded the pack, closed and reopened offline. It restored a saved count and Slate 3D appearance, then reached the counting draw through actual 3D board moves. Board claims also survived offline undo/redo and save restoration. No runtime errors or horizontal overflow occurred.

Ranked matchmaking still needs the manual count-action protocol. Production deployment, remote persistence verification and tournament/referee certification are outside this pass. These limits remain visible in the rules atlas; the broad website goal remains active.
