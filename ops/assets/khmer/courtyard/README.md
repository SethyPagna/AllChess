# Courtyard — contemporary Cambodian collection

Courtyard is an original modern stone interpretation of Ouk Chaktrang pieces. It is not presented as a historical replica or archaeological reconstruction. Native roles remain Khon, Neang, Koul, Ses, Touk and Trey. Tall, short and low silhouettes remain distinct; a promoted Trey uses the Neang form with the app's promotion mark.

The twelve transparent PNG masters were individually generated with the built-in image generator. Exact prompts, reference relationships and generation identifiers are in `prompts.json`. The 512px lossless WebP derivatives in `public/assets/khmer/courtyard` preserve generated alpha and only resize/encode the masters. Rebuild them with `npx tsx ops/scripts/assets/prepare-courtyard.ts`.

The separate Blender construction uses terraced octagonal feet, recessed pointed panels, distinct lotus forms, an open fluted Touk bowl and a low octagonal Trey with a recessed top. These are actual geometry. Honed sandstone and charcoal have original procedural grain/mineral shaders baked into embedded colour, roughness and normal maps. Their procedural source nodes and packed textures remain editable in `../courtyard.blend`; runtime uses `public/assets/khmer/courtyard.glb`.

Ses adapts Tina's [Horse Head](https://polyhaven.com/a/horse_head), released under [CC0](https://polyhaven.com/license). The pinned source URLs/checksums are in `../horse-source.json`. The sculpture is cropped, resized, reshaped and fitted to an original octagonal base. Its anatomical normal detail is retained. The 3D horse keeps the source's swept mane; the generated 2D design uses a shorter ridged mane. The two share the stone collection and native silhouette, but are not claimed to be identical reconstructions.

Rebuild with Blender 5.2: `blender -b -t 4 --python ops/assets/khmer/build_courtyard.py`. First restore the pinned horse source using `npx tsx ops/scripts/assets/download-atelier-horse.ts` if its ignored local cache is absent. The script exports twelve named, metre-scaled roots, writes the editable source and renders `../courtyard-preview.png`. Review angles and bake scratch files go to ignored `output/atelier/courtyard`.
