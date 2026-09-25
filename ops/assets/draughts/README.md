# Turned draughts collection

Original geometry authored locally in Blender 5.2.2 LTS for English, international and Turkish draughts. Four semantic roots provide light/dark men and kings. Each counter has rounded shoulders, recessed top grooves, a fine brass side inlay and a recessed felt foot. A king is two actual stacked counters, 22 mm high, compared with an 11 mm man. Both have a 42 mm diameter on a 53 mm square pitch.

- Editable source: `collection.blend`, including named meshes, material roles, delivery camera and lights.
- Reproduction: `blender --background --python ops/assets/draughts/build_collection.py` from the repository root.
- Portable runtime asset: `public/assets/draughts/collection.glb` (417,212 bytes), without external textures, fonts or imported meshes.
- Delivery render: `public/assets/draughts/collection.png`.

Maple and wenge distinguish the two owners. Porcelain and slate are optional finishes, with the brass/felt roles retained. The browser adds a subtle continuous wood texture to the counters. The common physical board case has depth, rounded edges, a brass reveal, feet and cast shadows. English draughts uses an 8×8 chequered surface; international draughts expands to 10×10 with its own slate default; Turkish draughts uses an 8×8 plain grid and warm wood default because every square participates in orthogonal play. The Turkish 2D board and style preview follow the same plain-grid presentation.

The adjustable angled camera, orbit/zoom/reset, small unboxed edge labels, raycast moves, per-game preferences, saved history and 2D recovery all remain available. Kings switch to the stacked geometry on promotion; there is no extra crown button or board-level promotion ring. These are original contemporary designs, not replicas of a branded set.

Presentation references: [FMJD international rules, Annex 1, sections 2–3](https://www.fmjd.org/downloads/FMJD_Annexes_2024_8-sig.pdf) describe the 100-square board and crowning with a second man; [FMJD Turkish draughts](https://www.fmjd.org/downloads/td/TD_eng.pdf) illustrates its full-board orthogonal setup and promotion. This asset update does not certify the existing rule engines as tournament complete or alter their rules.

Geometry checks parse the actual GLB, verify all four names, ground contact, two separate counter meshes per king, exact stack heights, scale, portability and camera framing. Desktop/mobile browser tests exercise both players' promotion, selectable kings after rotation, finishes, orbit/reset, undo/redo, saved reload, capture continuation, failed downloads and WebGL recovery. See [delivery validation and remaining scope](../../docs/roadmap/draughts-tabletops.md).
