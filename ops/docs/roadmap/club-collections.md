# Club collections and factual move review

English, International and Turkish draughts now offer Turned, Rosette and Club as independent collections. Club has an ivory/oxblood lacquer finish and a distinct scooped dish, rounded rim, twin side grooves and physical stacked kings. Four individually generated transparent sprites are paired with an original UV-mapped GLB and packed editable Blender source. [Masters, exact prompts and provenance](../../assets/draughts/club/README.md).

The compact three-card selector applies a collection to both views. Rosette is the default for unset or invalid draughts preferences; an explicitly saved Turned choice is preserved. Discovery artwork also uses Rosette. Each game's preference is read independently from its board view and material, including when storage access fails. Board colours and material recolours remain separate from collection identity. Club is included in the public offline pack.

Setup buttons use Bot, Match, Friend, Watch and Local so the action remains visible on a narrow screen. Full accessible names are preserved. The move timeline no longer manufactures quality classifications, numeric grades or best-line claims from move order. It shows notation and factual events: captures established by consecutive positions, promotions, drops, passes and opening removals. Missing capture evidence remains unknown. Existing playback and live-board navigation remain available.

Royal-safety probes now copy their affected board cells rather than the entire game snapshot. Search budgets and safety scope are unchanged. [Measured cause, preserved behavior and regression evidence](bot-runtime.md).

## Verification

- Lint and TypeScript pass. The full default `npm test` run passes all 716 tests across 80 files, including the two previously failing bot timing gates with unchanged limits. The production build passes for 209 pages and prepares 129 public offline assets, 58.2 MiB.
- The actual Club GLB is parsed for four embedded PBR maps, self-contained buffers, semantic roots, grounded dimensions, UVs, shared king meshes and a physically recessed dish. It is 2,254,860 bytes. Angled and low-angle Blender renders were inspected; the packed source retains editable procedural materials and original geometry.
- Fresh production-browser checks cover all three draughts games at 320, 390 and 1440 pixels. Both sides promote in 3D; all four sprite roles decode; undo/redo, collection/board/material changes, orbit and per-game persistence preserve the position. First/last/live review navigation restores the correct position and shows factual promotion labels without grades or best-line claims. Nine viewport checks finish without runtime exceptions, failed requests or horizontal overflow.
- Twelve picker checks cover three games, two phone widths and Light/Dark appearance: three visible collection cards, targets at least 44 pixels, no clipped mode labels, bounded panels and Escape focus restoration. Twelve additional scenarios verify fresh, explicit legacy, corrupt and blocked-storage preferences.
- A fresh persistent profile downloads the play pack, closes completely, reopens to a blank page and disables networking before entering offline play. The same three-game promotion, collection, board/material, viewport, orbit, undo/redo and persistence audit passes, with all four sprite roles available and no failed requests or runtime exceptions.
- An unavailable Club GLB and deliberate WebGL context loss both preserve a promoted king through 2D fallback. Switching collections restores a playable 3D scene.
- One older long-lived test-browser session became unresponsive during reload. It was closed; the complete online audit passed in a fresh session, and the separate cold-offline audit passed. The cause of that session failure was not established. Windows ANGLE continues to report its nonfatal shader precision warning; extended and physical-device browser validation remain open.

## Remaining scope

The active goal includes camera composition and all game families. Three geometric draughts collections are now available, but Turned still uses its earlier vector 2D art. Further individually designed regional collections, board-surface art, physical-device GPU/PWA checks, localization and account features remain unfinished. Generated masters guide modeled geometry; they are not exact reconstructions. Optional material recolours do not count as new collections. No deployment or merge is included.
