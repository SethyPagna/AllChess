# Celadon Xiangqi checkpoint

This checkpoint adds a second native Xiangqi collection, Celadon, alongside the default Boxwood. It is an original contemporary ceramic design, with fourteen individually generated transparent faces and a matching uninterrupted wood board image. Exact prompts, generation identifiers and reference lineage are saved in [the artwork source](../../assets/xiangqi/celadon/README.md). The built-in image-generation tool was used one image at a time; runtime encoding preserves the generated pixels and alpha.

The real GLB contains fourteen native piece roots, carved character and ring recesses, a stepped glazed body, an unglazed annular foot, and six embedded glaze/clay maps. A shared exterior reduces duplication without flattening the individual engraved faces. The final model is 7,069,776 bytes; the packed editable Blender source is 24,879,158 bytes. Native discs measure 44 mm across and at most 12.8 mm tall. The [model documentation](../../assets/xiangqi/celadon-model.md) retains cultural references, font provenance and reproduction details. The generated brush lettering and Noto-derived modeled characters are coordinated interpretations rather than exact reconstructions.

Collection, Artwork/Clear/Letters, board colour, 2D/3D view and finish remain independent per-game choices. Janggi keeps its own native options. The Wood surface image spans the complete board in both views; river, grid, palace markings, move feedback and 3D lighting remain live. Optional texture failure preserves a playable surface. The existing physical case and owner-facing 3D rotations remain intact. Letters has a fixed pale background and dark red/black ink in either app theme.

The catalog now carries the selected mode through artwork, primary buttons and guide actions. Bot, friend, online and watch selections no longer silently open a local game; capability gates remain in force. The offline pack includes all new assets. Its staged estimate is 83.49 MiB, so the verified download limit rises from 80 to 88 MiB. Boundary and malformed-manifest regressions ensure rejected updates preserve the previous complete pack.

## Verified at this checkpoint

- The optimized staged model and all generated source/runtime art pass 60 asset checks without weakened assertions: semantic roots, dimensions, actual blind cuts, ring/foot geometry, normal/UV validity, map variation, alpha, glyph identity and provenance.
- 61 focused UI/offline integration checks, 13 catalog action checks and the final 34-case worker suite pass. The worker suite includes fifteen new boundary/malformed-manifest regressions.
- TypeScript, full lint and the production build pass. The build generates 209 pages and an offline manifest with 175 assets totaling 87,548,553 bytes (83.49 MiB), within the 88 MiB limit. A new full-suite run hit 15-second timeouts in existing asset/API tests during host resource contention and was stopped for the user's quota-saving wrap-up; it is incomplete, not a passing gate. The previous 851-test result belongs to the prior Shogi checkpoint.
- Blender previews and individual generated pieces were reviewed. This does not replace production playing-size review.

## Resume before calling the collection visually complete

The user requested a quota-saving wrap-up before production visual review. Prepared scripts are local, ignored evidence under `output/playwright/celadon/`: preferences, 36 compact controls combinations, 93 3D appearance captures, native cannon gameplay/recovery, and persistent-profile cold restart. Catalog navigation checks are in `output/playwright/compact/catalog-mode-fixed.js`. Run them against the new production build, inspect actual Light/Dark alpha compositing and small-screen camera views, and fix any failures before claiming completion. The WebP file preview can expose RGB in fully transparent pixels; judge the actual browser composite.

Use AllChess port 3002; port 3000 belongs to another project. For cold restart, download into a fresh explicit browser profile, close it fully, reopen at `about:blank`, disable networking before navigation, then use `/offline?game=xiangqi`. Verify all fifteen images, the fourteen-root GLB, saved Celadon/Wood/3D/Slate choices and both owners' captures, undo/redo and camera controls. Do not substitute `variant=xiangqi`, which the offline shell does not read.

No production deployment, merge, physical-device validation or completed all-app redesign is claimed. The broader goal still needs further native collections, board artwork, all-page refinement and final cross-game coverage.
