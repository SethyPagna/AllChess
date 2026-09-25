# Shatranj and Chaturanga tabletops

Two distinct original Blender collections bring native 3D to twenty of the twenty-one playable games, across ten collections. Shatranj uses compact cream/turquoise ceramic forms: thrones, paired tusks, a projecting horse head, a wedge chariot and a faceted pawn. Chaturanga uses a sculpted army in contrasting wood tones with royal pavilions, elephants, horses, wheeled chariots and helmeted infantry. Each game gets a plain wooden grid, its own coloured frame, physical case and feet, soft light and contact shadows. The camera remains angled and adjustable; coordinates remain small unboxed rim text.

Default and carved 2D styles now use original regional silhouettes matching the 3D identities. Alternative glyph and themed styles remain available. Selecting a piece shows one short movement hint below the board, without moving the board under the pointer. Ministers/Ferz and elephant/Alfil pieces retain their own names, geometry, movement and promotion identity. This presentation change does not alter the existing rules, saved state or room protocol.

## Design sources and scope

The [Metropolitan Museum's Nishapur set](https://www.metmuseum.org/art/collection/search/452204) informs Shatranj's abstract vocabulary; its [chess history](https://www.metmuseum.org/exhibitions/listings/2011/the-game-of-kings-medieval-ivory-chessmen-from-the-isle-of-lewis/exhibition-blog/game-of-kings/blog/shah-mat) provides context for the relationship to Indian chess. The [Chess Variant Pages description of Chaturanga](https://www.chessvariants.org/historic.dir/chaturanga.html) describes an unchequered board. The new assets are contemporary interpretations, not museum replicas or claims to reconstruct one universal historical ruleset. Existing game-specific rule guides continue to describe the implemented profiles.

Editable sources, generators, portable models and delivery renders are included under the historical/Chaturanga/Shatranj asset directories. The two GLBs add approximately 935 KiB and contain no external dependencies. Both are part of the verified public offline pack.

## Validation

Live browser checks cover elephant jumps over occupied pawn lines for both owners, movement hints, one-step pawn restrictions, all finishes, desktop and 320 px layouts, and undo/redo. Imported study positions verify both-side automatic promotion to the correct native models, moves by promoted pieces after board rotation, orbit/zoom/reset, saved material/orientation recovery and continued play after reload. Failed model downloads and WebGL loss recover to the unchanged 2D position. No runtime exceptions or horizontal overflow appeared in those checks; deliberate failed-asset requests produce expected network errors, and Windows ANGLE reports a nonfatal shader precision warning.

Actual GLB tests verify every named starting/promoted model, metre-scale bounds, grounding, portability and camera framing. 2D tests verify the regional identities and accessible promoted labels. Service-worker tests cover both models alongside the other regional collections.

A fresh production Chrome profile downloaded the public pack, imported both promotion studies, promoted both owners and saved rotated porcelain boards. The browser then closed entirely and reopened with networking disabled before navigating to the saves. Both games restored their native models and preferences, continued play with a promoted piece, and retained undo/redo at 320 px without runtime exceptions or overflow. A subsequent browser check verifies that choosing Carved actually changes the complete 2D army while preserving regional silhouettes and ownership.

Lint, TypeScript and production build pass: 209 pages and 92 public offline assets, approximately 25.6 MiB. The core suite passes 530 tests across 74 files. No engine or bot-search behavior changes in this delivery.

Jungle's native 3D set, full localization, account friend lists/ratings, remaining referee and tournament work, physical-device installation and deployed multiplayer checks remain open. No production deployment or remote migration is included.
