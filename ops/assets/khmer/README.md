# Ouk Chaktrang piece collection

Original Cambodian-inspired carved study made for AllChess with Blender 5.2 through the Higgsfield 3D Jutsu tools. This is a contemporary interpretation of turned playing pieces, not a historical replica or a scan of an existing commercial set.

- Project: https://higgsfield.ai/3d-jutsu/07c5439c-9640-4fc0-a586-70e1d5b8ffa6
- Committed revision: 1, operation `allchess-khmer-model-02`.
- Editable source: `collection.blend` (1.28 MB).
- Browser model: `public/assets/khmer/collection.glb` (621 KB).
- Delivery render: `public/assets/khmer/collection.png`.
- Six shapes in two materials: Khon, Neang, Koul, Ses, Touk, Trey.
- Metre scale, semantic object names, editable lathed geometry and bevel modifiers. No third-party textures or imported meshes.
- The app lazy-loads Three.js and the GLB only when 3D is selected. Meshes are reused across the board; camera and display plinth from the collection are excluded from play.
- The 2D SVG collection is original vector work with matching piece identities.

Creation brief: readable small silhouettes, progressively taller royal/general shapes, a sculpted horse, an open boat-shaped rook, and low fish counters; warm sandstone versus polished rosewood with brass accents. Keep the collection editable, portable, and light enough for browser play.

The Blender render and the browser board were visually inspected. Native first-move and promotion rules use https://www.pychess.org/variants/cambodian and its linked championship reference. Published digital counting is implemented; referee-dependent tournament interpretations and competitive verification remain an explicit rules gate (see `ops/docs/roadmap/ouk-counting-profile.md`).

The collection now uses the shared renderer with classic chess: material choices, top/angled cameras, reset view, coordinate labels, promoted-piece rings, and direct recovery to 2D. Its board remains plain and its six native model identities are unchanged.
