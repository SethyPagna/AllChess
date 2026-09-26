# Cambodian atelier artwork

Twelve individually generated transparent PNG masters created with Codex's built-in image-generation tool on 2026-09-27. These are contemporary Cambodian-inspired designs, not historical replicas. Light pieces use waxed boxwood, dark pieces use oxblood rosewood, both with a hairline aged-brass foot inlay. The default Ouk Chaktrang 2D set uses these assets; the Clear Khmer vector option remains available.

The native masters are 1280 × 1280 RGBA PNGs. The browser derivatives are 512 × 512 lossless WebP images with transparency. The conversion only resizes and encodes; the artwork remains unaltered:

```powershell
npx tsx ops/scripts/assets/prepare-atelier.ts
```

## Generation briefs and references

Each piece was generated separately, inspected, and used as a material/style reference for the next. Common brief: one isolated piece on transparency, slightly elevated orthographic product view, crisp studio light from upper left, detailed but readable at chess-square size. No floor, external shadow, text or watermark. Natural fine wood grain, satin wax, incised collar rings, tiered circular foot and restrained brass inlay.

- `light-horse.png`: Cambodian Ses horse bust in left-facing profile. Anatomical muzzle, jaw, eye, nostril, two ears and an arched neck with detailed mane carving; double-torus pedestal. Established the material and camera reference.
- `light-king.png`: Matching Khon king, using the horse as reference. Wide tiered foot, concave waist, three annular collar tiers, elongated lotus-bud finial with incised petal fluting. No European cross or jewels.
- `light-queen.png`: Matching Neang, using the king as reference. Shorter concave waist, one broad collar and a smaller closed bud; visibly lower than the king.
- `light-bishop.png`: Matching Koul with a broad pointed six-petal teardrop finial, narrow collar and shorter body. Preserve the common foot and light boxwood material.
- `light-rook.png`: Matching Touk as an open shallow bowl on a short turned waist and the shared circular foot. Keep the rim and interior cavity clearly defined.
- `light-pawn.png`: Matching Trey as a low domed circular counter with an incised ring, subtle wood grain and the same restrained brass foot band.
- `dark-horse.png`, `dark-king.png`, `dark-queen.png`, `dark-bishop.png`, `dark-rook.png`, `dark-pawn.png`: Each is an individual image-generation edit of its corresponding light master. Preserve silhouette, proportions, pose, camera, carving, transparency and brass. Replace only the pale boxwood material with deep oxblood rosewood, with readable warm grain and controlled specular highlights.

These are recorded generation briefs, not seed-deterministic recipes. Image generation is stochastic; the native masters are the authoritative outputs.

## 3D boundary

This artwork is not a completed mesh reconstruction and is never used as a billboard in the 3D board. Ouk's prior playable Blender collection remains in place while its quality revision is unfinished. Higgsfield exposed image-to-3D model descriptions in this session, but no callable generation endpoint. No remote reconstruction job was submitted. Future 3D replacements need full geometry, UV/PBR materials, multi-angle inspection and real browser validation.
