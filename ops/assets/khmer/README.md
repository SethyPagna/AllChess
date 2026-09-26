# Cambodian atelier 3D collection

The default Ouk Chaktrang 3D set now uses `public/assets/khmer/atelier.glb`. Its twelve named light/dark pieces are real geometry with embedded UV colour, normal and roughness maps. `atelier.blend` is the packed editable source. The earlier `collection.blend` and `collection.glb` remain historical studies; they are no longer the default playable asset.

This is a contemporary Cambodian-inspired set, not a historical replica. The individually generated [2D atelier masters](atelier/README.md) establish the boxwood/rosewood palette, tiered feet, lotus forms, hollow Touk bowl and restrained brass inlay. The 3D set interprets those designs; it is not an image-to-mesh reconstruction or a set of billboards.

## Geometry and provenance

- Khon, Neang, Koul, Touk and Trey are original editable revolved profiles. Lotus incisions and the bowl cavity are geometry, including the interior floor. The rim ring has no cap faces across the cavity.
- Ses adapts Tina's [Horse Head](https://polyhaven.com/a/horse_head), released under [CC0](https://polyhaven.com/license). The source plinth is removed; the anatomical bust is scaled and fitted to the set's own turned foot. The original UV sculpt-detail normal map is retained, and separate UVs carry the wood grain. This sculpt differs from the generated 2D horse in posture and mane shape.
- Both woods use graded colour and satin roughness baked from the CC0 [Wood Table 001](https://polyhaven.com/a/wood_table_001) scan. Wood source credits and checksums are in [the material notes](../materials/README.md). All required runtime maps are embedded in the GLB and packed into the Blender file.
- `horse-source.json` records the exact source URLs, byte lengths and MD5 checksums. The downloader verifies them. No website preview images or unlicensed commercial models are included.
- Mesh dimensions use metres and semantic roots compatible with the board renderer. The tallest piece is approximately 74 mm; all footprints fit a 53 mm square. Each piece stays below 25,000 triangles. The complete GLB is approximately 8 MB.

## Reproduce

From the repository root, with Node and Blender 5.2:

```powershell
npx tsx ops/scripts/assets/download-atelier-horse.ts
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 4 --python ops/assets/khmer/build_atelier.py
```

The build exports the playable GLB and packed `.blend`, then renders a collection view and three horse views to the ignored `output/atelier` directory. `-- --collection-only` skips the additional horse renders. The committed [collection render](atelier-preview.png) shows the delivery geometry and materials; real browser checks are recorded in [the delivery notes](../../docs/roadmap/khmer-atelier-3d.md).

The app preserves per-game appearance choices. Alternate material finishes remove photographed wood colour/pores while retaining the horse's sculpted relief. The offline manifest includes the new GLB. The camera bounds account for the taller king and balance both screen axes using perspective depth.

## Remaining quality scope

This is one coordinated collection. Porcelain and slate recolours are material options, not three independently designed sets. Distinct additional Cambodian collections, additional board surface art, the remaining regional model replacements and physical-device GPU validation remain under the active goal.
