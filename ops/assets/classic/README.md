# AllChess classic carved collection

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

The shared renderer adds actual porcelain and slate material choices, board colours, angled/top camera presets, reset view, coordinates, selected/last-move markers, legal target dots/rings, and promoted-piece rings. King of the Hill's central objective and Racing Kings' finish rank receive distinct tints. Camera and material choices persist per game. Board rotation changes coordinates and asymmetric piece orientation together.

## Validation

The Blender delivery image and desktop/mobile browser renders were inspected. Automated checks parse the actual GLBs, confirm all semantic roots and playable dimensions, reject external asset dependencies, and keep camera framing inside the viewport. Browser audits check lazy loading, all nine supported game views, raycast moves in both camera presets and after rotation, castling, promotion, Crazyhouse drops, saved preferences, and 320/390-pixel layouts. Failed downloads and lost WebGL contexts offer a direct 2D fallback without resetting the game.

Three.js and the model load only when 3D is chosen. Models share geometry; rendering happens on board/camera/size changes, not every clock tick. Materials, textures, listeners, controls, geometry, and the renderer are disposed on teardown. Keyboard board interaction remains available in the 2D view; the 3D canvas currently uses pointer/touch interaction.
