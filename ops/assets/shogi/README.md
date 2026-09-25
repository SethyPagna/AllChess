# AllChess Shogi tile collection

Original pentagonal tile geometry authored locally in Blender 5.2.2 LTS for Shogi and Mini Shogi. Both players use the same boxwood appearance; the pointed ends identify ownership. Sente's king carries 玉 and Gote's carries 王. Eight base types and six promoted faces are provided for each side, with black front lettering and vermilion promotion lettering. These are separate face models, not a flip animation.

- Editable scene: `collection.blend` (about 219 KB), with semantic roots, bevel modifiers, shared geometry, material roles, delivery camera and lights.
- Portable runtime collection: `public/assets/shogi/collection.glb` (about 562 KB), containing only the 28 piece roots and their meshes. No external textures or font dependencies.
- Delivery render: `public/assets/shogi/collection.png`.
- Reproducible generator: `build_collection.py`. Run Blender in background with `--python ops/assets/shogi/build_collection.py -- PATH_TO_FONT.otf` from this checkout.

Letter outlines are converted from **Noto Serif CJK JP Bold**, copyright 2017–2024 Adobe, under SIL OFL 1.1; see `FONT-LICENSE.txt`. Font source: [Noto CJK repository](https://github.com/notofonts/noto-cjk/blob/main/Serif/OTF/Japanese/NotoSerifCJKjp-Bold.otf). The downloaded font's SHA-256 is `861a2b2c0e24b23745c262be8c3fdef63f12628f0492fb120ee51aa55c503af8`. The font binary is not bundled. The editable scene and GLB retain the converted lettering meshes.

The one-character labels and promoted-piece identities follow the [Japan Shogi Association's rules, articles 3–5](https://www.shogi.or.jp/match/taikyoku_rules/): 竜, 馬, 全, 圭, 杏 and と. The existing rules engine supplies promotion, captures, drops and ownership; the renderer does not infer these from appearance.

## Runtime presentation

Shogi gets a 9×9 plain grid and Mini Shogi a 5×5 grid, with slightly rectangular cells, a thick kaya-coloured wooden block, softly cut legs, continuous grain, directional lighting and table shadows. The shared renderer now sizes the physical board and angled camera from the game dimensions. Mini Shogi keeps extra camera distance to contain its thick case. Small unboxed numeric files and Japanese ranks sit on the edges. The 9×9 board includes its four grid stars.

Pieces point toward their opponent and rotate with the board. Promotion selects its own vermilion face; captures and drops use the current owner and unpromoted state. Boxwood, porcelain and pale slate retain dark/red lettering and use the same body colour for both players.

Both games have physical wooden **komadai** to each player's right, built as bevelled tops, stems and bases in `tabletop-scene.ts`. They use the same procedural grain and lighting as the board and rest on its table. Their positions and hand layout live in `shogi-stands.ts`; the default angled camera includes both stands, even when empty. This follows the [Japan Shogi Association's introduction to captured pieces](https://www.shogi.or.jp/event/english-pamphlet.pdf) and the [French Shogi Federation's explanation of placement on the player's right](https://shogi.fr/2022/11/1204/).

Captured pieces appear face-up, unpromoted and oriented for their new owner. Up to three tiles stack per type, with a small unboxed label showing the exact count when more than one is held. Tapping a tile selects a legal drop; an invisible slot-sized target makes the sloping model easier to hit. Ownership, turn, pause, review and network permissions use the existing hand controls' checks. Flipping the board swaps the hands' physical positions and direction. Review hands come from the displayed historical position, including the accessible player-card buttons. The drop hint sits below the 3D scene so it cannot obscure a stand. Keyboard board play remains in 2D, while accessible hand buttons remain available beside the canvas.

The new model is included in the build-generated offline manifest and the service worker's explicit asset allowlist. Appearance remains specific to each game. Failed or incomplete downloads and WebGL loss offer 2D recovery without resetting the match.

## Validation

Tests parse all six actual collections, check semantic roots, portable dependencies, dimensions and ground contact. Shogi checks include all promotion faces, dark/red matte ink, camera framing for both board sizes and stands, full-hand layout, count preservation and ownership through a flip. The offline worker test verifies the model can be downloaded and served without networking.

Browser checks exercise both games, both-side promotion, a captured-pawn drop onto the 3D board, rotation, orbit/zoom/reset, all materials, 390/320-pixel layouts, failed asset download, and context-loss recovery. No runtime exceptions occurred. The Windows ANGLE compiler emitted a nonfatal floating-point precision warning (`X4122`); rendering and interaction completed successfully. Delivery and in-app desktop/mobile renders were inspected.

The hand-stand update passes lint, TypeScript and the production build (209 pages; 87 offline assets, 24.2 MiB). The 70-file core suite passes 487 cases, excluding the unchanged general bot suite. Four repeatable browser scenarios in `ops/tests/e2e/shogi-stands.spec.ts` play real capture sequences on both board sizes at desktop and mobile widths, select both owners' physical tiles, reject wrong-owner/occupied-square actions, drop after rotating, and verify historical hands are read-only and empty at the initial position.

A fresh persistent production Chrome profile downloaded the pack, captured pieces, saved the porcelain 3D view, closed, and reopened offline at mobile width. It restored both hands, selected a stand tile, orbited/reset without consuming it, dropped it onto the board, and verified the result in 2D. The scene also fit at 320 pixels with no runtime errors or overflow. Physical-device and deployed-host validation remain outstanding.
