# Xiangqi and Janggi native tabletop collections

Original geometry authored locally in Blender 5.2.2 LTS. Xiangqi uses turned boxwood discs with matte ink outlines and circular face borders. Janggi uses bevelled octagonal ivory tiles: generals are largest, advisors and soldiers smallest. Both sides share the same body material; red/black and red/blue lettering distinguish the players. Janggi uses readable regular Hanja, an original interpretation rather than a reproduction of traditional cursive Cho lettering.

## Assets and reproduction

- Editable scenes: `xiangqi.blend` and `janggi.blend`, including semantic roots, meshes, material roles, lights and delivery camera.
- Portable models: `public/assets/xiangqi/collection.glb` (673 KB) and `public/assets/janggi/collection.glb` (495 KB), each with 14 named piece roots. No runtime font or texture downloads.
- Delivery renders: `public/assets/{xiangqi,janggi}/collection.png`.
- Generator: `build_collections.py`. From the repository root, run Blender in background with `--python ops/assets/intersection/build_collections.py -- xiangqi PATH_TO_TC_FONT.otf`, or use `janggi` and the KR font.

Letter outlines are converted from Noto Serif CJK Bold, copyright 2017–2024 Adobe, under SIL OFL 1.1 (`FONT-LICENSE.txt`). Font binaries are not bundled. Sources and downloaded SHA-256:

- [Traditional Chinese font](https://github.com/notofonts/noto-cjk/blob/main/Serif/OTF/TraditionalChinese/NotoSerifCJKtc-Bold.otf): `a4441a76dbf56719600c5dcbd5b5e5a068a20944cc41c959487a657133576ee6`.
- [Korean font](https://github.com/notofonts/noto-cjk/blob/main/Serif/OTF/Korean/NotoSerifCJKkr-Bold.otf): `10cc03741178ad6d2747df8497d911e34b167d0474a826fb9d866c402cbe3d8f`.

## Native boards and identity

Both games use a single continuous wooden surface, with pieces on 9×10 intersections and diagonal palace markings. Xiangqi has an open river, cannon/soldier registration marks, and a rosewood case. Janggi has uninterrupted files and a green lacquer case. Both have thickness, bevelled rims, feet, lighting and table shadows. Small unboxed coordinates remain consistent with the app's move notation. Selection uses rings around intersections. Material choices preserve ink colors and keep both players' tiles pale enough to read. The camera is freely adjustable within playable angles and has one reset control.

Board references: [World Xiangqi Federation rules](https://www.wxf-xiangqi.org/images/wxf-rules/2018_World_XiangQi_Rules_English2018.pdf) and [PyChess Janggi rules](https://www.pychess.org/variants/janggi).

The Janggi audit corrected inherited Xiangqi setup errors. New games place generals in palace centres, identify red as Han and blue as Cho, and start Blue. Red receives 1.5 material points when consecutive passes end a new game. Catalog seat ordering remains red/blue to preserve owner orientation and clocks. New states carry `janggiProfile: cho-first-v1`; unversioned saved positions retain the previous zero-compensation scoring policy. Opening knowledge and expected replies match the corrected first player. The default is elephants inside horses. All four opening formations are now selectable in local/bot play and through ordered Han-then-Cho confirmation in friend rooms and Quick Match; see [formation setup and validation](../../docs/roadmap/janggi-formations.md). Further tournament/bikjang profiles remain outstanding.

## Validation

Tests parse actual GLBs and check every semantic root, physical dimensions, ground contact and self-contained dependencies. Camera tests contain the 9×10 board and corner pieces. Grid tests check river splits, continuous Janggi files, palace diagonals and in-bounds registration marks. Engine tests cover first turn, palace centres, new scoring and legacy compatibility. The worker test downloads and serves both new models offline.

Browser checks exercise legal moves for both owners, board rotation, orbit/zoom/reset, three finishes, 390/320-pixel layouts, and WebGL loss recovery. No runtime exceptions or page overflow occurred. Windows ANGLE emits the existing nonfatal floating-point precision warning X4122. Desktop/mobile renders and Blender delivery renders were inspected. Keyboard board navigation remains in 2D; physical-device validation remains outstanding.

Lint, TypeScript and the production build pass (209 generated pages; 86 verified offline assets, 23.6 MiB). The core suite covers 438 cases and the general bot suite 73; stale Janggi opening/scoring and summary expectations were corrected and the affected cases rerun successfully. A new production Chrome profile downloaded the pack, closed, reopened offline, restored Janggi's saved 3D porcelain view, and continued play. It then opened Xiangqi with its separate boxwood preference and made a 3D move. Cambodia/classic camera checks and the Shogi promotion/drop/fallback browser checks also pass.
