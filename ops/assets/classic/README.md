# AllChess Western piece assets

## Current marble set

The default Western 3D collection is adapted from **Chess Set by Riley Queen**, distributed by [Poly Haven](https://polyhaven.com/a/chess_set) under [CC0](https://polyhaven.com/license). The artist supplied the geometry, UV layout and PBR texture maps. This is an adaptation of a third-party asset, not original AllChess sculpting.

- Editable packed source: `marble.blend` (Blender 5.2).
- Browser model: `public/assets/classic/marble.glb`, a standalone glTF 2.0 binary with embedded base-colour, normal and packed occlusion/roughness/metallic maps for both owners.
- Matching 2D assets: twelve transparent 640 × 640 Cycles renders in `public/assets/classic/marble/`.
- Pinned source URLs, sizes and checksums: `marble-source.json`.

Adaptation removes the source board and duplicate pieces, normalizes the twelve semantic roots to metres, grounds each base, sets the king to 68 mm and aligns both knight masters. Original artist UVs and 2K maps are preserved. The app supplies the physical board and lighting. Only modern Western variants use these models; regional and historical games retain their own identities.

To reproduce from the pinned public source:

```powershell
npx tsx ops/scripts/assets/download-marble.ts
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 4 --python ops/assets/classic/prepare_marble.py -- output/playwright/polyhaven-chess/chess_set.gltf
```

The source download includes the board textures required by the original glTF importer. They are not used by the runtime pieces. The GLB preserves real geometry and texture maps; the PNG renders are used only in the 2D view. Every modern Western variant uses the same semantic root contract below, including promotions and Crazyhouse drops.

The file is approximately 12.2 MiB and loads only when 3D is selected. Included in the downloadable offline pack. Runtime anisotropic filtering helps texture clarity at an angle, and all loaded textures are released with the board. Other finishes retain the mesh but override its base colour; Original displays the artist's marble maps.

## Earlier procedural collection (retained source)

Original geometry made in Blender 5.2 through Higgsfield 3D Jutsu for this app. No imported meshes, external textures, or commercial set scans. The ivory/walnut design uses turned bodies, brass foot inlays, crown pearls, an open bishop mitre, carved horse profiles, and rook battlements.

- Project: https://higgsfield.ai/3d-jutsu/3ce789ed-7358-4da9-8fa4-a07fa3440938
- Committed revision: 1, operation `allchess-classic-model-01`.
- Editable Blender source: `collection.blend` (2.55 MB).
- Portable browser asset: `public/assets/classic/collection.glb` (808 KB).
- Delivery-camera render: `public/assets/classic/collection.png`.
- Generation source: `build_collection.py`, using Blender's `bpy` and the Higgsfield artifact registry. Geometry is in metres; bodies and separate decorative parts remain editable in the blend. The bishop's boolean cut is baked for portable export.

## Runtime contract

Twelve named root objects: `light_king`, `light_queen`, `light_bishop`, `light_knight`, `light_rook`, `light_pawn`, and the six corresponding `dark_` objects. The app clones these roots and replaces their positions; the display plinth, collection camera, and collection lights are not included in play. Pieces fit a 53 mm square pitch and stand on the local ground plane.

The collection is enabled for Classic, Chess960, Crazyhouse, Antichess, Horde, King of the Hill, Three-check, and Racing Kings. It is deliberately not assigned to Chaturanga, Shatranj, Makruk, Shogi, Xiangqi, or Janggi, whose native pieces need separate collections. Cambodia keeps its existing original collection.

The shared renderer adds actual porcelain and slate material choices, board colours, an adjustable angled camera, reset view, small unboxed edge coordinates, selected/last-move markers, legal target dots/rings, and promoted-piece rings. King of the Hill's central objective and Racing Kings' finish rank receive distinct tints. Material choices persist per game. The physical tabletop scene adds a bevelled walnut case, brass edging, raised frame, feet, procedural wood grain, reflective surfaces, and cast shadows. Board geometry and lighting are created by the shared renderer; the Blender assets supply the pieces. Board rotation changes coordinates and asymmetric piece orientation together.

## Validation

The Blender delivery image and desktop/mobile browser renders were inspected. Automated checks parse the actual GLBs, confirm all semantic roots and playable dimensions, reject external asset dependencies, and keep camera framing inside the viewport. Browser audits check lazy loading, all eight supported modern Western game views, raycast moves and board rotation, castling, promotion, Crazyhouse drops, saved preferences, and 320/390-pixel layouts. The current tabletop audit additionally verifies orbit/zoom/reset, Cambodia and classic moves, unboxed 2D coordinates, and 320/390-pixel layouts. Failed downloads and lost WebGL contexts offer a direct 2D fallback without resetting the game.

Three.js and the model load only when 3D is chosen. Models share geometry; rendering happens on board/camera/size changes, not every clock tick. Materials, textures, listeners, controls, geometry, and the renderer are disposed on teardown. Keyboard board interaction remains available in the 2D view; the 3D canvas currently uses pointer/touch interaction.
