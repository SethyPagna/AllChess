# Piece asset quality revision

The previous portable GLBs met the playback contract but their simple geometry and flat materials did not meet the requested visual quality. This revision replaces the modern Western collection and two default 2D sets. Quality work on the other native collections remains unfinished.

## Delivered assets

- Eight modern Western games now load Riley Queen's [CC0 Poly Haven chess set](https://polyhaven.com/a/chess_set), adapted in Blender to twelve grounded semantic roots. The standalone GLB embeds 2K base-colour, normal and packed occlusion/roughness/metallic maps. The editable Blender file and a reproducible importer/renderer are committed. Twelve transparent 640-pixel Cycles renders provide matching 2D pieces.
- Ouk Chaktrang defaults to twelve individually generated boxwood/rosewood images, with distinct Khon, Neang, Koul, Ses, Touk and Trey forms. Native 1280-pixel PNG masters are preserved; 512-pixel lossless WebP derivatives retain alpha. Promoted pieces retain their marker and accessible names. Clear Khmer vectors and Khmer letters remain selectable. The design is a contemporary interpretation, not a historical replica.
- Natural timber cases use photographed 2K colour, normal and roughness maps from [Wood Table 001](https://polyhaven.com/a/wood_table_001), by Dimitrios Savva and Rico Cilliers, under [CC0](https://polyhaven.com/license). Pale kaya and painted/lacquered cases retain their native colours, while sharing the new normal and roughness maps. The key light is reduced and environment/fill strengthened to retain pale-piece surface detail and dark-piece highlights.
- Textures use anisotropic filtering in angled views. Model textures, shared geometry/materials and decoded ImageBitmaps are released on teardown. Original marble and alternate finishes preserve piece identities. The larger files still load only when 3D is chosen; the 2D board loads only its piece images.
- The offline pack includes all new images, embedded models and case maps. The outdated fixed download-size claim is removed from the UI.

Asset provenance, generation briefs and reproduction commands are in `ops/assets/classic/README.md`, `ops/assets/khmer/atelier/README.md` and `ops/assets/materials/README.md`. No website preview images are used as product assets.

## Validation

- Lint, TypeScript and the production build pass: 209 generated pages, 120 offline assets, 43.7 MiB. The full existing suite passed all 653 tests across 78 files. The added offline-asset regression and the final targeted model, icon, worker and documentation suite pass (70 cases, 654 unique tests in total).
- Actual GLB checks validate named roots, grounded dimensions, embedded buffers/maps and PBR material references. The pinned source downloader verifies every source checksum; transparent derivative generation completes successfully.
- Production Chromium decodes all 24 new 2D assets and plays both sides of Classic and Ouk in 3D at desktop and 320-pixel widths. Checks cover 2D moves, mode switching, undo/redo, rotation, material changes, zoom/reset and overflow. No runtime exceptions or required-asset failures occurred. Navigation-cancelled RSC prefetches are excluded from asset failures; Windows ANGLE still emits its nonfatal shader precision warning.
- Missing-GLB and lost-WebGL checks recover to the new 2D set with the moved position intact. All nine other native collection scenes are inspected after the shared material/lighting update, including pale Shogi, lacquered Janggi and Jungle.
- A fresh persistent browser downloads the verified pack, closes completely, then reopens with networking disabled before navigation. Both sets decode and continue actual 2D/3D play at desktop and phone widths, with no failed requests or runtime exceptions. The pack contains the new standalone GLB, all 24 raster pieces and all three case maps.

## Remaining quality work

Ouk's new images have not been reconstructed into production 3D meshes. Higgsfield listed image-to-3D models but did not expose a callable generation endpoint in this session, so no reconstruction job was submitted. The existing native Cambodian GLB remains playable. The images are never flattened onto cards in the 3D view.

Other regional miniature collections and the procedural playing-square surfaces need separate quality passes. All 21 games having playable 3D does not mean that all 21 have reached the requested art standard. The next replacements must preserve native silhouettes, match both owners, include UV/PBR materials and editable sources, and pass multi-angle and actual-game inspection. Physical-device GPU memory/performance testing also remains outstanding; desktop browser phone-size emulation is not a substitute.

This delivery does not deploy, merge the draft PR or change game rules, room protocols or save formats.
