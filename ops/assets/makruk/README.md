# Makruk collection

An original Thai-inspired set authored locally in Blender 5.2.2 LTS. Khun has a stepped finial, Met a compact pointed body, Khon a taller bulb, Ma a carved horse profile, Ruea an inverted-bell form, and Bia a low counter. The promoted counter presents a recessed reverse face and a fine brass inset. These are contemporary geometric interpretations, not scans or historical replicas.

- Editable source: `collection.blend`, with fourteen semantic roots, material roles, editable meshes and bevel modifiers, plus a delivery camera and lights.
- Runtime: `public/assets/makruk/collection.glb`, about 559 KB; six piece types plus a promoted Bia for each owner. No external textures, fonts or imported meshes.
- Delivery render: `public/assets/makruk/collection.png`.
- Reproduce from the repository root: `blender --background --python ops/assets/makruk/build_collection.py`.
- Original matching SVGs live in `src/components/board/makruk-piece.tsx`. Western styles remain explicit alternatives.

The default material pair is warm ivory and oxblood lacquer. Porcelain and slate retain the brass accents and eye inlays. A teak-coloured case supports an unchequered 8×8 grid, continuous grain, feet, a brass reveal and tabletop shadows. The freely adjustable angled camera retains reset and small unboxed edge coordinates. Promoted Bia use their own model instead of becoming visually indistinguishable from the starting Met; this is a state change, not a flip animation.

Setup and movement references: [GNU XBoard Makruk](https://www.gnu.org/software/xboard/whats_new/rules/Makruk.html) and [PyChess Makruk](https://www.pychess.org/variants/makruk). White's Khun now starts on d1, Black's on e8, each to the player's left of Met. Existing saved boards are not rewritten. Pawn promotion is on the sixth rank. The rules summary now identifies the remaining counting work: the inherited automatic counter is not the published optional board-honor/fixed piece-honor profile. This collection does not claim to complete that rules work.

Validation parses actual GLB geometry, including both promoted roots, checks metre scale and ground contact, and verifies framing. Bounds use transformed vertices rather than rotated axis-aligned approximations. Browser checks cover the corrected setup, both players' promotion, moving a promoted piece after rotation, all finishes, orbit/zoom/reset, 320/390-pixel layouts, failed model downloads and WebGL recovery. Desktop, mobile, SVG and Blender renders were inspected. No runtime exceptions or horizontal overflow; the existing nonfatal Windows ANGLE precision warning X4122 remains.

Lint and the final production build pass, including TypeScript, 209 generated pages and 87 verified offline assets (24.2 MiB). Core coverage is 441 cases; the geometry cases were rerun after replacing approximate rotated bounds with precise mesh bounds. Seven focused bot cases cover Makruk's difficulty sweep, cached openings/replies and training gates. A new production Chrome profile downloaded the pack, closed, reopened offline, restored both promoted counters and the saved porcelain 3D view, then moved a promoted Bia on the 3D board. No runtime errors or mobile overflow occurred.
