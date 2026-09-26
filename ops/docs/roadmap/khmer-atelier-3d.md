# Cambodian atelier and balanced camera

The default Ouk Chaktrang tabletop now loads a real textured collection with twelve semantic light/dark roots. The approximately 8 MB GLB embeds its colour, normal and roughness maps; the packed Blender source remains editable. Original turned lotus pieces, a hollow Touk bowl and low Trey counters share restrained brass inlay and satin boxwood/rosewood materials.

Ses adapts Tina's CC0 Horse Head sculpt from Poly Haven, with the source plinth removed, a new turned foot and separate UV wood grain over its retained sculpt-detail normal map. This is a contemporary Cambodian-inspired interpretation of the generated 2D atelier collection. The horse posture and mane differ from the 2D master; this is not a historical replica or an image reconstruction. [Provenance, checksums and reproduction](../../assets/khmer/README.md).

## Camera

Fit both screen axes using each physical corner's perspective depth. The previous fixed world-centred target left unused space opposite the nearest corner. The new fit balances opposite edges while retaining a 10% frame margin, the angled view, manual orbit/pan/zoom and reset. Include the taller Cambodian king in the bounds. Shogi trays and short-screen scrolling remain part of the fit.

Camera tests cover all 21 playable games at five board widths, plus short landscape cases. They verify visibility, near/far clipping, balanced opposite edges, captured-piece trays and gesture protection. Actual GLB checks verify grounded dimensions, semantic roots, embedded PBR maps, UV coordinates and a maximum of 25,000 triangles per piece. Alternate material finishes preserve the horse sculpt detail while removing wood grain.

## Validation

- 76 focused model, camera, offline-worker and documentation checks pass. The worker explicitly permits the new GLB and rejects private/unsupported cache targets.
- The development browser checks decode all twelve 512-pixel 2D derivatives, play both sides in 3D at desktop/320-pixel widths, switch 2D/3D, undo/redo and exercise camera controls. Nine finish/viewport combinations cover Original, Porcelain and Slate at 320, 390 and 1440 pixels, with an additional orbit in each. Camera drags preserve the position; the selected finish survives reload.
- Production framing checks cover all 21 games at 320, 390 and 1440 pixels: 63 combinations, no runtime exceptions, failed requests or horizontal overflow. Representative views from all eleven native collections were inspected. The setup action now sits below the camera hint rather than covering it on narrow screens.
- After the layout correction, nine production checks across Cambodia, Shogi and Jungle at the same widths verify the setup action clears the hint, has a 44-pixel minimum height and opens the setup controls.
- Missing-model and lost-WebGL recovery both return to the 2D board with the played position intact. The missing-model check uses a context without service workers so a cached response cannot hide the simulated failure.
- A fresh production browser profile downloads the 119-asset, 50.7 MiB pack, closes completely, reopens to a blank page and disables networking before navigating to offline play. All twelve images decode; both sides move in 3D; switching views, undo/redo, camera controls and material changes work without failed requests or runtime exceptions. The same gameplay check passes online in production. Windows ANGLE still emits a nonfatal shader precision warning.

## Remaining scope

This delivers one coordinated Cambodian collection. Porcelain and Slate are material options, not independently designed sets. The active goal still requires at least three distinct collections for each native family, improved regional geometry and playing-square art, broader theme/angle coverage and physical-device GPU/PWA checks. The previous full suite still has two unchanged bot timing failures; this increment does not relax those thresholds or claim overall completion.
