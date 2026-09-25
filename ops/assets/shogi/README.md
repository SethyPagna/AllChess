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

Pieces point toward their opponent and rotate with the board. Promotion selects its own vermilion face; captures and drops use the current owner and unpromoted state. Boxwood, porcelain and pale slate retain dark/red lettering and use the same body colour for both players. The existing accessible hand buttons choose pieces for raycast drops. A physical 3D hand tray and keyboard navigation within the 3D canvas are not included; keyboard board play remains in 2D.

The new model is included in the build-generated offline manifest and the service worker's explicit asset allowlist. Appearance remains specific to each game. Failed or incomplete downloads and WebGL loss offer 2D recovery without resetting the match.

## Validation

Tests parse the actual three collections, check semantic roots, portable dependencies, dimensions and ground contact. Shogi checks include all promotion faces, dark/red matte ink, and camera framing for both board sizes. The offline worker test verifies the new model can be downloaded and served without networking.

Browser checks exercise both games, both-side promotion, a captured-pawn drop onto the 3D board, rotation, orbit/zoom/reset, all materials, 390/320-pixel layouts, failed asset download, and context-loss recovery. No runtime exceptions occurred. The Windows ANGLE compiler emitted a nonfatal floating-point precision warning (`X4122`); rendering and interaction completed successfully. Delivery and in-app desktop/mobile renders were inspected.

The final lint, TypeScript and production build pass (209 pages; 84 offline assets, 22.5 MiB). The 62-file unit/domain/API suite passes 429 cases, excluding the unchanged general bot suite. A persistent production Chrome profile downloaded the pack, closed, and reopened offline: it restored Shogi in 3D with its saved porcelain finish, continued moves, then opened Mini Shogi with its separate boxwood preference and played another 3D move. No runtime errors or mobile overflow. Physical-device and deployed-host validation remain outstanding.
