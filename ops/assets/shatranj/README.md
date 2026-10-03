# Shatranj collection

Original cream and deep-turquoise ceramic interpretations: Shah and Ferz thrones with distinct heights, a two-tusk Alfil, an abstract horse, a split-wedge Rukh and a faceted pawn. The shapes draw on the Metropolitan Museum's [12th-century Nishapur chess set](https://www.metmuseum.org/art/collection/search/452204). These meshes are newly authored, not scans or exact replicas. No museum images or geometry are shipped.

Named roots use `light_` / `dark_` plus `shah`, `ferz`, `alfil`, `horse`, `rukh` and `pawn`. Promotion uses the Ferz model and the application's promotion marker. The compact proportions fit a 53 mm pitch. The portable GLB is about 367 KiB.

Rebuild both collections with Blender 5.2: `blender --background --python ops/assets/historical/build_collections.py`. The shared original generator writes each editable `.blend`, self-contained `.glb` and delivery `.png`. No third-party meshes, fonts, textures or runtime asset services are used. Directional pieces face the opposing army and retain that orientation when the board is rotated. Board and piece finishes are artistic material choices, not claims about historical materials.
