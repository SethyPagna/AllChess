# Shore stone models

Shore is an original contemporary Kōnane collection for AllChess. Its light coral-tone and dark basalt-tone pieces interpret the two approved imagegen masters; they are not scans, historical replicas, or meshes made from photographs. The existing collection and default selection remain separate.

## Sources and relationship

| Approved source | SHA-256 |
| --- | --- |
| `shore/light-stone.png` | `cfef186506b84f1c70c2a046ef935986432897a4263f1c9a4519ee5c1cc8b8e7` |
| `shore/dark-stone.png` | `f156291c15c6523ebcc5014616c23692b38acf11c7819ba6de65e900896c7f94` |

The source PNG bytes are preserved. The builder reads each alpha silhouette above 0.8, measures its radial outline around the solid bounding-box center, and retains its first ten Fourier coefficients to obtain a smooth, distinct contour. It then scales that contour to the dimensions below. The light master supplies the rounded triangular outline and broad shoulder; the dark master supplies its broader asymmetric outline.

Height, underside, worn contour variation, and individual pores are original modeled interpretations. The masters do not provide measured depth. The color palette and procedural mineral textures are visually informed by the masters, not extracted from their lit pixels. Their studio lighting and edge fringe are not projected onto the model. No third-party meshes, textures, photographs, fonts, or downloaded libraries are used.

## Geometry and placement

The GLB has exactly two scene roots, `light_stone` and `dark_stone`, each containing one mesh and one material. Both roots export with identity transforms. glTF uses metres and Y-up; the Blender source uses Z-up. The preview arrangement is applied only after GLB export.

| Measured property | Light | Dark |
| --- | ---: | ---: |
| Width X | 36.5814 mm | 37.3819 mm |
| Depth Z | 34.9980 mm | 34.4861 mm |
| Raw height | 15.4 mm | 14.7 mm |
| Ground Y | 0 mm | 0 mm |
| Maximum radial footprint | 19.8694 mm | 19.1830 mm |
| Runtime top after −6 mm placement | 9.4 mm | 8.7 mm |
| Authored vertices | 3,938 | 3,938 |
| Exported vertices, including UV seams | 4,169 | 4,169 |
| Triangles | 7,872 | 7,872 |
| Modeled pore depressions | 42 | 29 |

The portable meshes use 96 angular segments, 28 upper rings, and 14 lower rings. Broad outline and height differences are independent of the material. Pores are actual elliptical depressions in the upper surface, with fine grain and smaller pits supplied by normal maps. Separate editable detailed sculpts use 256 angular segments, 96 upper rings, and 48 lower rings in the hidden `Shore editable detailed sculpts` collection. They retain the same contour, material, and deterministic pore parameters.

The runtime board has 53 mm cells. Its well heights at radial distances 0, 8, 13, 17, 19.5, and 21 mm are −6, −5, −3, −0.5, +1.5, and +2 mm. For radius `r` in metres, the model's lower surface stays above `0.13*r + 14*r*r` before the runtime −6 mm translation. This raised underside clears the bowl while preserving the grounded center. Both footprints fit inside the 21 mm rim at arbitrary yaw, and both tops fit inside the 14 mm camera envelope.

Each root carries `master_sha256`, `master_relation`, `modeled_pore_count`, `mount_y`, and `pore_probes_json` extras. Each pore probe provides a glTF-local `[x, y, z]` downward-ray origin, major radius, and authored maximum depth. Probe Y is a ray origin, not a claimed measured cavity height. Tests can measure the actual mesh center and an outside ring; the ellipse minor radius is 0.82 times its major radius. Detailed sculpt objects retain the full pore parameters as JSON.

## Portable PBR material

Each owner has three embedded UV images:

| Map | Encoding | Size | Interpretation |
| --- | --- | --- | --- |
| Mineral color | JPEG, builder quality 90 | 512 × 512 | sRGB, original pigment and mineral variation |
| Detailed surface normal | Lossless PNG | 512 × 512 | Non-color tangent normal, continuous sculpt detail relative to the portable mesh |
| Occlusion / roughness / metal | Lossless PNG | 256 × 256 | Non-color RGB; R occlusion, G roughness, B zero metal |

The normal maps are analytically rasterized rather than ray-baked from a high-poly mesh or extracted from master lighting. Continuous object-space noise supplies seamless pigment and restrained micro-relief, avoiding UV-pole convergence. The normal generator evaluates the continuous sculpt plus smaller surface depressions, compares that detailed normal with the portable mesh's interpolated surface normal and tangent basis, and stores the resulting tangent-space residual. This retains pore contour detail between mesh vertices without doubling the modeled pore displacement. The upper modeled cavities also inform separate occlusion and roughness channels; cavity occlusion remains between 0.58 and 1. No directional illumination appears in base color. Both materials are opaque, double-sided, and effectively nonmetallic; the glTF metallic factor defaults to one and multiplies an identically zero blue texture channel.

The GLB has one embedded buffer, six embedded images, no external URI, and no required or optional glTF extension. It needs no decoder or extra texture fetch. Current size is **1,242,172 bytes (1.185 MiB)**, under the preferred 1.2 MiB target and 1.7 MiB model limit. GLB SHA-256: `1f3ad9959f9331e1f900eacfbbdaf16e52c7019567757fdc23148fe76362f0e5`.

## Editable source and rebuild

`shore.blend` packs all six material images and both unchanged approved source PNGs. It includes portable meshes, hidden detailed sculpts, materials, UVs, lights, a preview camera, and a neutral presentation support. The support, camera, lights, and detailed sculpts are excluded from the GLB. The preview support is not the runtime papamū.

Rebuild with Blender 5.2:

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background --threads 4 --python-exit-code 1 --python ops/assets/konane/build_shore.py
```

The builder writes `public/assets/konane/shore.glb`, `ops/assets/konane/shore.blend`, and `ops/assets/konane/shore-preview.png`. Add `-- --no-render` to skip only the preview render, or `-- --draft` for a 560 × 400, 12-sample lighting preview. It never modifies either master or the existing collection. The scene uses Cycles, 48 samples, four CPU threads, and the Khronos PBR Neutral view transform for the final 1400 × 1000 preview. The source opens with metric millimetre display and a material-preview camera view; hidden detailed sculpts share the portable pair's presentation placement.

The export is constrained to 1.7 MiB. The dedicated Shore asset tests separately check the delivered glTF structure, image lineage, geometric pores, native-well clearance, finite attributes, orientation, and camera fit. Their geometric gates use at most 0.15 mm bowl penetration tolerance and require more than 0.1 mm of actual center-to-mean-ring relief at all six pore probes; these are tested thresholds, not claimed extrema. Runtime integration, full-build, and browser verification are coordinated outside this model builder.
