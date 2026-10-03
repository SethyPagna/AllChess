# Rosette collections and automatic orbit framing

English, International and Turkish draughts now offer two independently modeled collections: the existing Turned set and the new Rosette set. A visual picker changes both 2D and 3D pieces. Board colours and material finishes remain separate, and the collection preference is saved per game. Changing appearance does not replace the game state or its timeline. Unrecognized/foreign preferences fall back to the native standard collection.

The Rosette collection includes four individually generated transparent masters, lossless 512-pixel runtime sprites, an approximately 4.2 MB self-contained textured GLB, an editable packed Blender source and a reproduction script. Twelve radial petals, concentric cut rings and reeded edges are actual geometry. Kings reuse two physical counter meshes with a visible stack seam. Matching light/dark men and kings keep ownership and promotion readable. [Masters, prompts and provenance](../../assets/draughts/rosette/README.md).

## Camera

The default orbit now recomposes the physical bounds as the angle changes. Previously a raised, rotated view could clip a case corner despite fitting correctly at the initial angle. Bounds include tall pieces and Shogi trays. Deliberate zoom buttons, wheel zoom, pinch, right-drag and modified-pointer pan switch to free composition; Reset view restores automatic framing. Resizing retains the chosen angle and respects the automatic/free distinction. Camera gestures must not become moves.

## Verification

- 128 focused checks pass, including native-set guards, actual GLB dimensions/shared king geometry/UV and PBR maps, all existing piece icons, worker asset allowlists, documentation and camera tests. The new camera cases cover all 21 games at two widths, five azimuths and three polar angles (630 fitted views). Lint, TypeScript and the 209-page production build pass.
- Development and production browsers promote both sides in each draughts game in 3D, decode all four sprite roles per game, switch collections, change board colours, exercise undo/redo and check per-game persistence. At 320, 390 and 1440 pixels they inspect 2D, 3D and an additional orbit, with position equality checks after gestures. No runtime exceptions, failed requests or horizontal overflow occurred.
- A fresh profile downloads the 124-asset, 55.5 MiB pack, closes completely, reopens to a blank page and disables networking before entering offline play. The same three-game promotion, collection, material, orbit, viewport, undo/redo and persistence checks pass with all four sprite roles and both GLBs available. No failed requests or runtime exceptions occur.
- Production default/additional-orbit screenshots cover all 21 games at 320 and 1440 pixels (42 viewport checks). Browser touch events verify pinch, two-finger pan, reset and no accidental selection; keyboard zoom, short-screen and landscape resizing also pass. Windows ANGLE retains its existing nonfatal shader precision warning.
- Missing-model and lost-WebGL checks preserve a promoted king when returning to 2D. Switching to the other collection successfully restores a playable 3D scene after recovery.
- Six 320-pixel picker checks cover all three games in Light and Dark appearance: no horizontal overflow, collection targets at least 44 pixels, Warm wood selection and Escape focus restoration.

## Remaining scope

This is the second geometric draughts collection, not completion of the three-set requirement. The Turned set still uses its earlier clear vector 2D presentation. Further independent collections, board-surface art, physical-device GPU/PWA checks and regional replacements remain active. Generated masters are not exact mesh reconstructions. The existing full-suite bot timing failures remain open; this increment changes no bot search thresholds.
