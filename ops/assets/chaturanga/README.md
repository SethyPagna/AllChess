# Chaturanga collection

Original sculpted army interpretation in sandalwood and rosewood tones: a royal pavilion, a smaller minister, an elephant with legs/ears/trunk/tusks, a horse, a wheeled chariot and helmeted infantry. These are contemporary designs representing the game's piece roles, not a reconstruction of one archaeological set. The [Metropolitan Museum's chess history](https://www.metmuseum.org/exhibitions/listings/2011/the-game-of-kings-medieval-ivory-chessmen-from-the-isle-of-lewis/exhibition-blog/game-of-kings/blog/shah-mat) provides historical context; the app retains its documented two-player rules profile.

Named roots use `light_` / `dark_` plus `raja`, `minister`, `elephant`, `horse`, `chariot` and `infantry`. Promotion uses the minister model and the application's promotion marker. The compact proportions fit a 53 mm pitch. The portable GLB is about 568 KiB.

Rebuild both collections with Blender 5.2: `blender --background --python ops/assets/historical/build_collections.py`. The shared original generator writes each editable `.blend`, self-contained `.glb` and delivery `.png`. No third-party meshes, fonts, textures or runtime asset services are used. Directional pieces face the opposing army and retain that orientation when the board is rotated. Board and piece finishes are artistic material choices, not claims about historical materials.
