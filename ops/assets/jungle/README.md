# Jungle animal collection

Original sculpted animal miniatures in warm ivory and deep jade resin tones, with brass inlays and dark eyes. Rats have low bodies, round ears and curled tails; cats have upright ears; wolves have longer muzzles and fuller tails; dogs have drooping ears and collars. Leopards have spots, tigers have stripes, lions have manes and elephants have broad ears, trunks and tusks. These are stylized tabletop figures, not archaeological reconstructions or realistic animal scans.

Named roots are `light_` / `dark_` followed by `rat`, `cat`, `wolf`, `dog`, `leopard`, `tiger`, `lion`, `elephant`. All models are grounded and fit the board's 53 mm pitch. The GLB is approximately 842 KiB, contains no external dependencies and ships in the public offline pack. Runtime finishes preserve brass and eye details. Pieces turn with ownership and board orientation; rats sit at the recessed river surface.

Rebuild with `blender --background --python ops/assets/jungle/build_collection.py` using Blender 5.2. The generator writes the editable `.blend`, portable `.glb` and studio `.png`. Geometry and materials are newly authored; no external meshes, textures, images or fonts are included.

The physical board is generated in `src/components/board/jungle-board.ts` and `tabletop-scene.ts`: wood banks, enamel rivers 8 mm below the land surface, brass crosses for traps and circular den inlays. Terrain comes from each saved board, so legacy positions retain their own layout. Rule sources, profile boundaries and validation are in `ops/docs/roadmap/jungle-tabletop.md`.
