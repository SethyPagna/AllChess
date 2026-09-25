# Janggi opening formations

Janggi now has four horse-and-elephant formations, with compact illustrated buttons before local or bot play. Each preview is read from that player's seat, so Blue's left/right arrangement is mirrored on the shared board. Changing clocks or starting another local game retains the chosen arrangement. The same board drives 2D, native 3D, bots, saved timelines and undo/redo.

The formation definitions and Han-before-Cho ordering follow the [PyChess Janggi reference](https://www.pychess.org/variants/janggi). The default remains elephants inside horses. Only the two adjacent horse/elephant pairs can be rearranged; generals, guards, chariots, cannons and soldiers stay in their normal positions. This update does not change the existing casual bikjang or scoring profile.

## Online setup

New friend rooms and Quick Match rooms start a persisted setup phase. Han confirms first; Cho sees that arrangement and then confirms. Each seat controls only its own choice. Both confirmations lock, repeated identical requests are harmless, and different late confirmations fail. Clocks remain stopped until both seats have arrived and setup is complete; Blue makes the first move. Spectators cannot confirm and ordinary moves cannot bypass setup.

Quick Match retains its 60-second admission deadline, now covering arrival and both formation confirmations. The panel explains the setup order and countdown. Cancellation or expiry closes admission without a played-game result; a delayed confirmation cannot revive it. Ordinary friend rooms have no setup countdown. After an accepted rematch the sides swap and formation selection starts again; a matched rematch receives a fresh 60-second setup window.

Room metadata stores confirmed choices separately from the playing state. The playing state records the opening formations for reconstruction after reload. Room review starts from those choices instead of assuming the catalog default. Local saves already preserve every board frame and variant metadata, so they need no format migration. Old rooms without setup metadata continue their existing game; old scoring profiles remain unchanged in replay, while newly started local games use the current profile.

## Validation

Domain tests cover all sixteen formation pairings, piece identity and owner-relative placement, legal opening moves, replay, saved timeline round trips, ordered seat authority, stopped clocks, repeated requests, stale game IDs, rematch side swaps, and cancelled/expired setup. Browser scenarios cover local 3D moves from a changed formation, clock changes, undo/redo, saved reload, two-browser friend rooms and Quick Match, opening review after reload, and fresh rematch setup on desktop/mobile.

A local Cloudflare runtime was stopped after Han confirmed and restarted from its stored data. Cho's pending setup and both unchanged clocks survived. Two concurrent, conflicting Cho confirmations produced one success and one conflict; retrying the winning confirmation left the board unchanged.

The final core run passes 495 cases across 71 files, and all six desktop/mobile browser scenarios pass. The production build generates 209 pages and an 87-asset offline pack (24.2 MiB). A fresh production Chrome profile downloaded the pack, saved a custom opening after a 3D horse move, closed, and reopened offline at mobile width. Red's repositioned horse then moved in 3D, and opening review restored both original choices. An additional offline bot game used another custom formation and retained it in review. No runtime errors or horizontal overflow appeared. The E2E helper retries only idempotent read requests on transport connection resets; HTTP errors and mutation failures remain failures.

Physical-device and deployed-host checks, account ratings, and additional tournament profiles remain open. No production deployment or remote migration is included.
