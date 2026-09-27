# Rosette draughts collection

Four individually generated transparent PNG masters define a contemporary boxwood/walnut collection for English, International and Turkish draughts. These are original game-art designs, not reproductions of a historical or tournament-certified set. A man is one counter; a king is two stacked counters. The rosette, turned rings and reeded edge distinguish the collection from the existing plain Turned set.

The built-in image generation tool created each image separately on 2026-09-27. The light man established the design; the dark man used it as a reference, the light king used the light man, and the dark king referenced the light king and dark man. [Prompts and generation records](prompts.json). The 1280-pixel PNG masters retain alpha. Runtime 512-pixel lossless WebP derivatives only resize/encode them; they are not substitutes for 3D geometry.

`../build_rosette.py` constructs the corresponding editable geometry in metres: twelve carved radial petals, two cut concentric rings, reeded edges and separate stacked counters. Shared mesh data avoids duplicating identical king geometry in the GLB. This is an interpretation of the generated art, not image-to-mesh reconstruction; exact grain and petal profiles differ.

The wood colour, normal and roughness maps derive from Poly Haven's CC0 Wood Table 001 scan. See [material provenance and pinned sources](../../materials/README.md). Colour grading and satin roughness are baked into portable textures and embedded in the GLB. No remote texture requests are required. `../rosette.blend` is the packed editable scene; `public/assets/draughts/rosette.glb` is the runtime asset.

Reproduce from the repository root:

```powershell
npx tsx ops/scripts/assets/prepare-rosette.ts
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 4 --python ops/assets/draughts/build_rosette.py
```

The browser uses a per-game collection preference independently of board colours and 3D material finishes. The original Turned set remains available, alongside the later [Club collection](../club/README.md). Rosette is the default when no valid collection was saved. Further board-surface artwork and physical-device validation remain under the active goal.
