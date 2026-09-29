# Shore

Shore is an original contemporary Kōnane collection: separately shaped pale porous and charcoal basalt-tone stones, with a quiet warm-gray stone playing surface. It supplements the existing wooden Papamū collection. Both owners use the native stone role; there are no ranks or promotions.

## Artwork and provenance

The two stone masters and the board surface were generated individually with the built-in image-generation tool on 2026-09-29. `source.json` records exact prompts, generation IDs, the light-stone cleanup lineage, and primary cultural references. `references/light-stone-first.png` preserves the first generation. The cleanup was itself an image-generation edit. The final masters are preserved without manual painting or background removal.

`light-stone.png` and `dark-stone.png` are transparent overhead piece sprites. They also guide the independently modeled 3D contours and material character; they are not a scan or a measured PBR material. The GLB uses authored physical geometry and separate color, normal and roughness maps. Its reproducible builder and packed Blender source live one directory up; model provenance records the actual export.

`board-colour.png` is uninterrupted material artwork without baked game pits, pieces, coordinates or shadows. The 3D board retains its real recessed wells and dynamic lighting; its continuous UV mapping spans the full board. The 2D board supplies live pit and move overlays.

Run `node ops/scripts/assets/prepare-shore.ts` from the repository root to fit and encode the runtime files. Sprites use 512-pixel lossless alpha WebP; the opaque board uses 1024-pixel WebP at quality 92. `prepared.json` records source and runtime hashes and byte sizes. Only runtime files enter the offline pack.

## Cultural scope

The [National Park Service material reference](https://www.nps.gov/puho/learn/historyculture/upload/Konane-Rules-508.pdf) describes dark lava and pale coral or shell pieces and depressions in lava surfaces. [Bishop Museum](https://blog.bishopmuseum.org/culture/pohaku-of-hawaii/) records stone and wooden boards. These references inform the material contrast; no museum scans, photographs or symbols are shipped.

AllChess preserves its existing 8×8 `nps-v1` rules. Shore does not claim to reproduce a historical artifact or the [Naihe tournament layout](https://www.bishopmuseum.org/konane2026/).
