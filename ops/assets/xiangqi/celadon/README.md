# Celadon Xiangqi artwork

Fourteen individually generated transparent piece masters and one separate opaque wood surface form the Celadon collection for Xiangqi. All were made with the built-in `image_gen` tool, one call per face or board. Exact prompts, reference roles and generation identifiers are preserved in `prompts.json` and `board-prompt.json`. The two early red-general references are retained under `references/` to preserve the accepted master's generation lineage.

The red faces are 帥, 仕, 相, 傌, 俥, 炮, 兵; the black faces are 將, 士, 象, 馬, 車, 砲, 卒. Native ownership remains readable through both pigment and the appropriate character. Soldiers retain their native face after crossing the river. The 2D artwork stays upright for reading; the physical 3D discs retain the existing owner-facing orientation.

Masters retain their original PNG pixels and alpha. `npx tsx ops/scripts/assets/prepare-celadon.ts` fits the complete pieces into 512px transparent lossless WebPs and encodes the opaque board at 1024px. No manual painting, character replacement, alpha cleanup or background removal is applied to the generated pixels. Runtime files live in `public/assets/xiangqi/celadon/`.

The warm, quiet wood colour map spans one complete board in the Wood board colour. The grid, river, palace diagonals, registration marks and move indicators remain live. Other board colours stay independent. The generated surface is a diffuse-colour reference, not a scanned or measured PBR material. Optional texture failure retains the existing playable surface. The native dark wooden case remains in 3D.

The ceramic set is an original contemporary interpretation, not a replica of an archaeological set or named artisan's work. Its pale jade-grey glaze, rolled shoulder and unglazed foot were developed with reference to ceramic craft and surviving cylindrical chess pieces; see [model references and provenance](../celadon-model.md). Matching three-dimensional geometry is independently authored in Blender, with real recessed characters and rings, a stepped body, an annular foot and embedded glaze/clay maps. Generated brush lettering and the verified Noto Serif outlines in the GLB are coordinated interpretations, not exact reconstructions. Editable source is retained in `../celadon.blend`.

Boxwood remains the default collection. Celadon, Artwork/Clear/Letters, board colour, view and finish are separate per-game preferences; Janggi retains its own native sets. All runtime assets are included in the public offline pack. Private matches and room state are not included in that asset pack.
