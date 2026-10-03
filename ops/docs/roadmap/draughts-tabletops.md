# Physical draughts boards

English, international and Turkish draughts now offer **3D counters**, using an original editable Blender collection. Men are single turned counters and kings are two physical tiers. The three games retain distinct board layouts and defaults: 8×8 green/ivory chequers, 10×10 tournament slate, and an 8×8 unchequered wooden grid for Turkish orthogonal play. The latter's 2D board and style preview also use a plain grid.

Native 3D now covers seventeen playable games across seven collections. The new asset is included in the service worker's public allowlist and the verified offline pack. It adds approximately 407 KiB, with no external textures or fonts. The build produces 209 pages and 88 public offline assets, totalling 24.6 MiB.

## Validation

The core suite passes 508 cases across 72 files; lint, TypeScript and the production build pass. Actual GLB checks verify named roots, board-scale bounds, ground contact, portable buffers, 11 mm men and 22 mm kings with two separate counter meshes, and camera framing for all three boards.

Ten desktop/mobile browser scenarios cover legal promotion for both owners, movement of a stacked king after rotation, all three finishes, orbit/zoom/reset, undo/redo, saved 3D/material restoration, compulsory continuation of a restored multi-capture, failed asset downloads and WebGL-loss recovery. The tests use imported small study positions and ordinary play controls; they do not inject moves into the page. No runtime errors or horizontal overflow appeared in the promotion scenarios. The initial audit's piece assertions were corrected to use the checker renderer's existing semantic attributes rather than chess-specific attributes, and model readiness explicitly waits for the asynchronous asset load.

A fresh production Chrome profile downloaded the new offline pack, promoted both players' international draughts men through actual 3D moves, saved the slate finish and rotated view, closed, and reopened offline at 320 pixels. Both stacked kings and preferences survived; the rotated king moved, undo/redo worked, and all three full opening layouts loaded offline at desktop and narrow widths. Runtime errors and horizontal overflow were absent.

Two independent browser contexts on the local room runtime verified 10×10 friend play: each player moved from their own 3D orientation, and both boards showed the authoritative moves. The production build without Cloudflare bindings correctly returned service unavailable; the audit also corrected misleading room-ready headings and notices during creation/failure. No deployed-room availability is claimed by this check.

The 3D scene uses the existing rules, bot and room state. This change adds presentation and delivery; it does not change or certify tournament rules. Physical-device testing, full localization, remaining regional collections and the account/multiplayer backlog remain open. No production deployment or remote migration is included.
