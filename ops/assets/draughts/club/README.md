# Club draughts collection

Club is an original contemporary collection for English, International and Turkish draughts. Ivory and oxblood lacquer, a broad rounded rim, a shallow scooped top with a low central grip and twin horizontal grooves distinguish it from the wooden Turned and Rosette collections. A man is one counter; a king is two physical counters. The design does not claim historical or tournament certification.

The built-in image generation tool made four individual transparent PNG masters on 2026-09-27. The light man establishes the design. The dark man references it; the light king references the light man; the dark king references the light king and dark man. [Exact prompts and generation records](prompts.json). The 1280-pixel PNG files preserve the original alpha. The runtime 512-pixel lossless WebP files only resize/encode those masters.

The corresponding original geometry is built by `../build_club.py`, with a 42 mm diameter, 8 mm tall counter and two tiers for kings. The `.blend` is editable and packed; the GLB embeds its textures. This is modeled interpretation of generated design references, not image-to-mesh reconstruction. The 2D light and microtexture are baked into the sprite; 3D uses the live scene lights.

The 1024-pixel ivory and oxblood colour maps, satin roughness and tangent-space microfinish normal map are baked from the original procedural lacquer materials retained in Blender. No third-party geometry or scanned textures are used. Kings share the same counter mesh as men, with the upper tier offset by 8.2 mm. The runtime GLB is approximately 2.3 MB and has no external texture dependencies.

Reproduce from the repository root:

```powershell
npx tsx ops/scripts/assets/prepare-club.ts
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 4 --python ops/assets/draughts/build_club.py
```

The same per-game collection choice selects the sprites and model. Board colours and alternate material finishes are independent. The original lacquer is the coordinated Club appearance; Porcelain and Slate are optional recolours and do not count as additional collections.
