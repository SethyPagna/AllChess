# Kōnane Shore collection

Shore adds a second selectable Kōnane collection while preserving the original Pebbles set and existing 8×8 rules. Each owner has its own generated overhead stone sprite and independently shaped 3D mesh. A coordinated stone surface spans the 2D board and the real recessed 3D pits.

## Presentation

The light stone uses a pale porous material; the dark stone uses charcoal basalt tones. Their outlines follow separate image masters, while the heights, modeled pores and PBR maps are authored in Blender. The portable GLB embeds color, normal and roughness channels. The source Blender file retains editable detailed sculpts and packed images.

Shore's native board choice is labeled Stone. Other palettes, original/Porcelain/Slate finishes, rotation and adjustable camera remain separate controls. Both owners appear in the collection preview without introducing extra piece roles or a redundant text-style selector. Coordinates remain small unboxed edge text.

The board retains actual bowl geometry and a support slab below the bowl bottoms. Its continuous texture does not paint in pits, game pieces, lighting or move markers. Case faces use a common physical texture scale, avoiding stretched grain along the narrow rim. Subtle depth-derived cavity shading keeps empty wells visible; small dark coordinates remain unboxed. Optional board-image failure falls back to a matte stone material.

## Sources and scope

[Artwork provenance](../../assets/konane/shore/README.md) links the original prompts, generation IDs, source/runtime hashes and primary material references. This is a contemporary collection rather than a scan or historical replica. It retains the existing `nps-v1` game profile; it does not implement a different tournament board or rule set.

The new images and model total 2,099,024 bytes before code/build changes. The final offline pack contains 182 assets totaling 91,202,855 bytes (86.98 MiB), below its unchanged 88 MiB limit. Its explicit runtime-only allowlist excludes master PNGs, Blender sources, previews and arbitrary neighboring paths.

Further large collections will need a smaller or selective offline asset pack; this addition leaves about 1 MiB of the current allowance. That packaging work remains separate from Shore's acceptance.

## Verified at this checkpoint

The corrected full suite passes **1,369 tests across 116 files**, including twelve dedicated Shore image/model cases and forty offline-worker cases. After a material refinement removed polar texture pinching and improved pore readability, all twelve asset tests passed again on the final model bytes. The subsequent case-UV fix passes all 32 scene/model cases, including physical texture density, aligned faces and bevels. Changed-file lint passes. Mesh checks measure actual pore depth, underside clearance against native bowl geometry, finite textured volume, independent owner geometry and camera bounds; image checks verify alpha, framing, contrast and exact source/runtime hashes. These are successive checks, not a claim that the earlier full run included later visual refinements.

The initial production build and interaction checks passed, but visual review rejected stretched case textures, indistinct empty wells and low-contrast edge labels. Those defects were corrected and reviewed again on the final local production Worker. The final production build passes mandatory TypeScript, all 209 generated pages and Cloudflare packaging with the actual realtime worker exports.

Final browser checks used system Chrome 153 on Windows with a local production Worker, D1 and R2. Reports and captures remain local under `output/playwright/shore-final/`:

- All six combinations of 320/390/1440 px and light/dark pass 2D/3D rendering, three finishes, three board palettes, orbit/zoom/reset, unchanged game state during camera movement, collection persistence and switching back to Pebbles. The compact appearance panel has no horizontal overflow. Reviewed captures show consistent stone texture scale, clear unboxed coordinates and visible empty wells.
- At 320 and 1440 px, both native opening removals, short and long captures, rotated pointer input, undo/redo and saved-game reload pass.
- Deliberately missing board artwork retains a playable 3D surface. Actual WebGL loss recovers through 2D to a working 3D board. Missing model data offers a working 2D board with all 64 sprites. Only the deliberately aborted asset requests produce expected errors.
- The complete pack downloads and commits the exact final manifest. After full browser shutdown, a new browser process disables networking before opening the saved-game URL. It restores the exact position, Shore/Stone/3D/Slate choices and board orientation. Camera controls, captures, undo/redo and offline reload pass. All 182 entries are present in the active cache; the four Shore files match their exact byte counts and SHA-256 values. Both download and cold runs finish without browser errors or failed asset requests.

The collection inventory is now **17 distinct wired designs across 11 families**, with Kōnane at **2/3**. The broader three-collections-per-family goal still needs sixteen designs plus unfinished artwork and quality work within existing collections. Finishes and palettes do not count as independent collections. Physical-device GPU/touch testing, production multiplayer/account validation and the other outstanding game/app work remain separate requirements; this checkpoint does not claim deployment or a finished product.
