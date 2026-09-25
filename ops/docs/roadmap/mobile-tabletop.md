# Mobile tabletop framing and camera controls

Delivered on `codex/compact-game-studio` in September 2026.

The angled 3D view now fits the physical case, edge pieces and captured-piece stands to the available width. Narrow boards use a taller canvas and a slightly higher camera angle, with less sideways skew. Short windows also cap the canvas height, leaving space outside the gesture surface for page scrolling. The physical boards, lighting, materials and small unboxed rim coordinates remain shared with the desktop studio.

Shogi and Mini Shogi use compact wooden hand trays at the two ends below 520 pixels of board width. Wider views retain the traditional side stands. Captured tiles remain selectable, preserve ownership and counts, and follow board rotation. The responsive arrangement is a practical app layout, not a claim about traditional tabletop placement.

Zoom in, zoom out and reset now have at least 44-pixel button targets. Players can orbit, pinch and pan with two fingers or right-drag. Resizing preserves a customized viewing direction, target and relative zoom; reset returns to the current fitted view. Pointer tracking prevents a drag that returns to its starting point, a pinch or a canceled touch from becoming a piece selection.

## Validation

- All 653 tests across 78 files pass, including the bot suite. Thirty-two new cases exercise complete physical bounds for all 21 games, short windows, hand-tray placement/rotation, projected board size and gesture cancellation. Existing camera projection helpers now use the responsive fit.
- Lint, TypeScript and the production build pass: 209 generated pages and 93 public offline assets, 26.4 MiB.
- Browser checks at 320 pixels execute moves in Classic, Ouk Chaktrang, Xiangqi, Janggi, Makruk, Jungle, international draughts, Kōnane, Chaturanga and Shatranj. Shogi and Mini Shogi checks execute both owners' hand drops, rotation, undo/redo and a move after resizing to desktop. Camera buttons meet their minimum target size; no horizontal overflow or runtime exceptions occurred.
- Real browser touch input exercises pinch and two-finger pan without selecting a piece. Height-only resizing and landscape framing pass. Keyboard activation operates zoom. A resize round trip retains the rendered framing, with only tiny shadow rasterization differences; reset restores the starting view.
- A new persistent production browser downloads the pack, saves Shogi and Cambodian positions with porcelain pieces, closes entirely, then reopens with networking disabled. Both games restore their 3D materials and continue legal play, including a compact-tray Shogi drop. Zoom/reset and undo/redo work at 320 pixels with no failed requests or runtime exceptions.

For the tested phone projection, the visible board surface grows about 28% for Classic, 80% for Jungle and roughly twofold for Shogi compared with the previous fixed landscape camera. These are calculated surface-area comparisons, not physical-device performance measurements.

## Remaining scope

The product goal remains active. Physical-device touch/PWA validation, full localization, deeper regional bot evaluation, account friend lists and ratings, referee-dependent competitive modes and guide-only engines remain. Keyboard square-by-square play remains available through 2D. This delivery does not deploy, migrate remote data or merge the draft PR.
