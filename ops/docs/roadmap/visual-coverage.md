# Visual collection coverage

Follow-up: the [Celadon checkpoint](celadon-checkpoint.md) adds a sixteenth wired model collection, fourteen more individually generated faces and a second coordinated generated board. Its assets and focused integration checks pass; production appearance and offline validation remain pending. The inventory below preserves the earlier pre-Celadon snapshot and its counting rules.

Snapshot: 2026-09-27, current working tree after Carved Shogi and its grid correction, before the next Xiangqi collection is delivered. This is an asset and runtime-wiring inventory, not a visual-quality certification or deployment claim.

## Counts and counting rules

The authoritative playable list is `src/lib/variants/catalog.ts`: **21 games**. `src/components/board/board-3d-config.ts` maps them to **11 native visual families**. Its default model paths plus the overrides in `src/components/board/piece-sets.ts` wire **15 distinct model collections**. Three independently designed collections per family would require 33; the current structural shortfall is **18 collections**, before upgrading incomplete existing art.

Count a collection when its own model design is wired to a playable family. Do not count Porcelain/Slate material overrides, palette changes, Clear/Letters readability choices, Castle/Pirate SVG presets, preview renders, or retained unused models as additional coordinated collections. Reaching a collection count does not establish generated 2D art, coordinated board artwork, matching 2D/3D silhouettes, or acceptable real-device rendering.

Five collections have individually generated piece masters: Atelier (12), Courtyard (12), Rosette (4), Club (4), and Carved/Hori (15), totaling **47 PNG masters and 47 runtime WebPs**. Marble instead has 12 Blender-rendered PNG sprites. Only Carved/Hori currently has a separately generated, coordinated board-colour image used in both 2D and 3D.

## Every playable game, grouped by native family

| Family and exact game keys | Wired collections / three-set target | Current 2D pieces | Remaining asset work |
| --- | --- | --- | --- |
| Modern Western: `classic`, `chess960`, `crazyhouse`, `antichess`, `horde`, `king-of-the-hill`, `three-check`, `racing-kings` | **1/3**: Marble | 12 transparent 640px Cycles renders; optional SVG/glyph styles | Two new designs; individually generated reference/art workflow and collection-specific board art remain absent. All eight share one model design despite different default board colours. |
| Cambodian: `ouk-chaktrang` | **2/3**: Atelier, Courtyard | 12 independently generated sprites per collection; Clear Khmer SVG and Khmer letters are separate readability styles | Third design; coordinated board art; recover original Atelier prompt/job records if available. Horse sprites and licensed 3D sculptures are coordinated interpretations, not identical reconstructions. |
| Japanese: `shogi`, `mini-shogi` | **2/3**: Printed, Carved/Hori | Printed uses CSS pentagonal surfaces and live glyphs; Carved uses 15 generated faces, including both kings and all six promotions | Third design; Printed lacks generated individual artwork. Both games intentionally share native faces/models but have different board sizes and per-game preferences. |
| Draughts: `english-draughts`, `international-draughts`, `turkish-draughts` | **3/3 by count**: Turned, Rosette, Club | Turned uses SVG counters; Rosette/Club each have four generated sprites for both owners' men/kings | Count met, full asset goal unfinished: Turned lacks generated sprites and none has a coordinated generated board image. English/international use chequered boards; Turkish has a plain grid. |
| Chinese: `xiangqi` | **1/3**: native turned discs | CSS disc/tile surfaces and native live glyphs | Two new designs, individual raster art, richer embedded surface assets and coordinated board art. Next-collection work is not counted until integrated and validated. |
| Korean: `janggi` | **1/3**: native octagonal tiles | CSS disc/tile surfaces and Hanja glyphs; no photographic sprites | Two new designs, individual raster art, coordinated board art, and stronger matching of 2D outlines to the 3D octagonal hierarchy. Current regular Hanja is an interpretation, not a traditional cursive replica. |
| Thai: `makruk` | **1/3**: native carved/lacquer forms | Original native SVGs, including promoted Bia; optional Western styles | Two new designs, individual generated art, richer model surfaces and coordinated board art. Preserve the distinct promoted-Bia model in future sets. |
| Ancient Indian: `chaturanga` | **1/3**: sandalwood/rosewood army | Original native historical SVG silhouettes | Two new designs, individual generated art, surface-detail pass and board artwork. Current sculpted army is a contemporary interpretation, not an archaeological reconstruction. |
| Persian: `shatranj` | **1/3**: cream/turquoise abstract army | Original native historical SVG silhouettes | Two new designs, individual generated art, surface-detail pass and board artwork. Museum reference is documented; museum scans/images are not shipped. |
| Animal game: `jungle` | **1/3**: ivory/jade miniatures | CSS animal tiles/discs with native glyphs; no individual raster animal art | Two new designs, generated animal sprites, richer modeled surfaces and terrain artwork. Existing animals are stylized miniatures, not realistic scans. |
| Hawaiian: `konane` | **1/3**: coral/basalt pebble forms | Original SVG stones | Two new designs, individual stone art and coordinated papamū material artwork. Existing recessed bowls are real geometry, not evidence of finished texture collections. |

2D routing is in `src/components/board/piece-icon.tsx`, `photographic-piece.tsx`, `khmer-piece.tsx`, `makruk-piece.tsx`, and `historical-piece.tsx`. Theme/readability options in `appearance.ts` and `piece-sets.ts` must not inflate these counts.

## Actual runtime models and editable sources

The GLB JSON chunks were read directly for this inventory. All 15 wired GLBs have embedded buffers and no external buffer/image URIs. “Images” below counts embedded image payloads; zero means no baked texture images in that GLB, not an absent material. Shared runtime grain/material overrides can still change its appearance. Root counts below are actual active-scene roots, not inferred from filenames.

| Runtime GLB path | Piece roots / embedded images | Editable source and builder |
| --- | --- | --- |
| `public/assets/classic/marble.glb` | 12 / 6 | `ops/assets/classic/marble.blend`; `ops/assets/classic/prepare_marble.py` |
| `public/assets/khmer/atelier.glb` | 12 / 5 | `ops/assets/khmer/atelier.blend`; `ops/assets/khmer/build_atelier.py` |
| `public/assets/khmer/courtyard.glb` | 12 / 7 | `ops/assets/khmer/courtyard.blend`; `ops/assets/khmer/build_courtyard.py` |
| `public/assets/shogi/collection.glb` | 28 / 0 | `ops/assets/shogi/collection.blend`; `ops/assets/shogi/build_collection.py` |
| `public/assets/shogi/hori.glb` | 28 / 6 | `ops/assets/shogi/hori.blend`; `ops/assets/shogi/build_hori.py` |
| `public/assets/draughts/collection.glb` | 4 / 0 | `ops/assets/draughts/collection.blend`; `ops/assets/draughts/build_collection.py` |
| `public/assets/draughts/rosette.glb` | 4 / 4 | `ops/assets/draughts/rosette.blend`; `ops/assets/draughts/build_rosette.py` |
| `public/assets/draughts/club.glb` | 4 / 4 | `ops/assets/draughts/club.blend`; `ops/assets/draughts/build_club.py` |
| `public/assets/xiangqi/collection.glb` | 14 / 0 | `ops/assets/intersection/xiangqi.blend`; `ops/assets/intersection/build_collections.py` |
| `public/assets/janggi/collection.glb` | 14 / 0 | `ops/assets/intersection/janggi.blend`; `ops/assets/intersection/build_collections.py` |
| `public/assets/makruk/collection.glb` | 14 / 0 | `ops/assets/makruk/collection.blend`; `ops/assets/makruk/build_collection.py` |
| `public/assets/chaturanga/collection.glb` | 12 / 0 | `ops/assets/chaturanga/collection.blend`; `ops/assets/historical/build_collections.py` |
| `public/assets/shatranj/collection.glb` | 12 / 0 | `ops/assets/shatranj/collection.blend`; `ops/assets/historical/build_collections.py` |
| `public/assets/jungle/collection.glb` | 16 / 0 | `ops/assets/jungle/collection.blend`; `ops/assets/jungle/build_collection.py` |
| `public/assets/konane/collection.glb` | 2 / 0 | `ops/assets/konane/collection.blend`; `ops/assets/konane/build_collection.py` |

Both Shogi files include eight base and six promoted roots per owner. Makruk includes six base roles and a promoted Bia per owner. Draughts includes men/kings for both owners. Other listed roots cover their native roles for both owners. This is structural coverage; the existence of a root alone cannot establish correct carving, glyphs, normals, scale or rendering.

`public/assets/classic/collection.glb` and `public/assets/khmer/collection.glb` remain historical studies. Each actually contains 17 scene roots: twelve pieces plus delivery/gallery objects. Their accompanying `.blend` and `collection.png` files do not make them a second/third current selectable set. Likewise, each family's `public/assets/<family>/collection.png` is a whole-collection delivery render, not a runtime sprite sheet or an individually generated piece set.

## Provenance and board surfaces

| Asset group | Authoritative provenance / limitation |
| --- | --- |
| Marble | `ops/assets/classic/README.md` and `marble-source.json`: Riley Queen's Poly Haven CC0 chess set, adapted and rendered in Blender. It is not original AllChess sculpting or image generation. |
| Atelier | `ops/assets/khmer/atelier/README.md`: twelve masters and generation briefs exist, but no exact per-image prompt/generation-ID manifest is present. `ops/assets/khmer/README.md` and `horse-source.json` document original bodies, Tina's CC0 horse-head adaptation and scanned wood. Do not invent missing generation IDs. |
| Courtyard | `ops/assets/khmer/courtyard/prompts.json`: twelve exact prompts/generation records, matching twelve masters and runtime sprites. `README.md`, `build_courtyard.py` and the shared horse source describe original stone geometry/procedural maps and the licensed horse adaptation. |
| Rosette / Club | `ops/assets/draughts/rosette/prompts.json` and `ops/assets/draughts/club/prompts.json`: four exact prompt/generation records each. Rosette uses CC0 scanned wood; Club bakes original procedural lacquer. Both are independently modeled interpretations of generated art. |
| Carved/Hori | `ops/assets/shogi/hori/prompts.json`: fifteen exact glyph/prompt/generation records. `board-prompt.json` records the separate board generation. `ops/assets/shogi/hori-model.md`, `build_hori.py` and `FONT-LICENSE.txt` document original carved geometry, baked maps and licensed Noto outlines. |
| Printed / Xiangqi / Janggi | `ops/assets/shogi/README.md`, `ops/assets/intersection/README.md` and their `FONT-LICENSE.txt` files document original geometry, converted Noto glyphs and pinned font hashes. No individual image-generation records exist for their current 2D styles. |
| Other native families | `ops/assets/{makruk,chaturanga,shatranj,jungle,konane}/README.md` document original procedural geometry and cultural/reference boundaries. No individual generated sprite masters/manifests are present. |
| Shared case maps | `ops/assets/materials/README.md` and `wood-table-source.json` document Poly Haven CC0 Wood Table 001. Runtime maps: `public/assets/materials/wood-table/{colour,normal,roughness}.jpg`. These shared case textures are not separate family board-art collections. |

The only coordinated generated board master is `ops/assets/shogi/hori/board-colour.png`, with runtime `public/assets/shogi/hori/board-colour.webp`. `src/styles/studio.css` and `src/components/board/board-3d.tsx` apply it to Carved's Wood board; `tabletop-scene.ts` also coordinates the case and komadai. Other colours retain procedural/palette surfaces. Live grids, stars, terrain, highlights and coordinates are geometry/shaders/CSS rather than baked into that image. No distinct generated board art is currently wired for the other ten families. Jungle's recessed rivers and Kōnane's wells are native physical board geometry, which future texture work must preserve.

## Evidence limits and completion gates

This audit read runtime registries, source/builders, provenance files, master/derivative counts and actual GLB headers/JSON. It did not reopen Blender, render assets, run the test suite, or test physical devices. Existing delivery notes are evidence records, not a substitute for reviewing future changes:

- `ops/tests/app/board-3d.test.ts` covers baseline semantic models/scale and native terrain; `tabletop-camera.test.ts` covers framing. `courtyard-assets.test.ts` and `hori-assets.test.ts` add collection-specific structural checks. Tests and implementation must agree before crediting a new asset as integrated.
- [Atelier](khmer-atelier-3d.md), [Courtyard](courtyard-camera.md), [Rosette](rosette-collections.md), [Club](club-collections.md), and [Carved](hori-collections.md) record focused geometry, gameplay, visual and offline checks. The latter includes 75 asset cases, both owners' capture/promotion/drop sequences, cold restart, final surface/grid fixes and explicit remaining limits.
- Baseline native delivery records: [intersection games](intersection-tabletops.md), [Makruk](makruk-tabletop.md), [historical games](historical-tabletops.md), [Jungle](jungle-tabletop.md), [Kōnane](konane-tabletop.md), and [draughts](draughts-tabletops.md). Earlier documents may describe superseded assets or old test totals; current registries and binaries control this inventory.

For each outstanding collection, require complete native roles and promotions for both owners, real individually reviewed artwork, documented prompts/licenses/sources, an editable source, portable grounded GLB geometry with valid PBR maps, and coordinated board art. Inspect the actual playing-size result at compact/desktop sizes and default/side/low camera angles. Exercise selection, rotation, capture, promotion/drop where applicable, save restoration, offline loading and 2D recovery. Apply each game's native ownership, glyph and board semantics rather than copying a Western set.

Physical-device GPU/memory/performance and real touch testing remain unfinished across families; browser viewport emulation is not that evidence. Direct keyboard board play remains in 2D. This visual ledger does not certify tournament rules, deployed multiplayer, or additional games absent from the 21-entry catalog. The all-app goal remains active; no family receives a blanket “finished” label from collection count or file presence.
