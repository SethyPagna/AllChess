# Kōnane: recessed papamū and versioned rules

Kōnane now has its own **3D stones** view: original Blender pebbles, 64 recessed bowls in a continuous wooden surface, a thick rounded case, feet, lighting and contact shadows. The supporting case ends below the bowl bottoms, so the depressions are real geometry. Coordinates remain small, unboxed text on the rim. Orbit, zoom, reset, rotation and material choices use the existing controls. The 2D board also uses plain timber with pit cues, while retaining keyboard play.

This brings native 3D to eighteen games across eight collections. The self-contained stone GLB is about 55 KiB; the editable Blender source, generator and delivery render are included. No remote textures, fonts or model dependencies are required. It is a contemporary interpretation, not a historical artifact replica.

## Rules profile

New games use `konaneProfile: "nps-v1"`, based on the [National Park Service Hōnaunau instructions](https://www.nps.gov/thingstodo/play-konane.htm) and [illustrated rules](https://www.nps.gov/puho/learn/historyculture/upload/Konane-Rules-508.pdf). Black removes any own stone, then White removes any own stone; adjacency is not required in this published variation. Thereafter, moves jump opposing stones orthogonally into empty pits. A player may stop after any jump but cannot turn a corner within the move. No legal jump loses.

Every valid straight landing prefix is offered as one atomic move. Choosing the farther endpoint removes all intervening enemies and grants one clock increment. Bots, local games and authoritative rooms use the same move generator. The UI explains opening removals and landing choices in one short line. The rules guide identifies the source profile; this does not claim universal or tournament-standard Kōnane rules.

Unversioned saves retain the previous White-first opening, adjacent second removal and forced continuation behavior. Saved timelines preserve their metadata; friend-room review restores the correct opening profile before replay. New games and rematches use the new profile. Bot opening seeds now begin with Black. The starting-position review badge uses the timeline's actual first mover.

## Validation

Lint, TypeScript and the production build pass. The final full core run passed 522 cases across 74 files, including the new offline-manifest regression. Of 73 bot cases, 72 passed together and the remaining existing 90 ms cache-hit assertion passed in isolation after missing its threshold under concurrent load. This timing sensitivity is recorded rather than treated as a Kōnane rules failure.


- Domain tests cover all four jump directions, every landing prefix, stopping early, atomic three-stone capture, one clock increment, blockers, gaps, corners, no-move wins and legacy replay.
- Saved-file tests preserve both profiles and their histories; room tests check seat authority, Black-first removals, nonadjacent White removal, rejoin, replay and atomic multi-capture.
- Actual GLB checks verify named models, metre-scale bounds, ground contact and portable buffers. Geometry tests verify recessed centres, flush square boundaries and upward normals; camera tests cover the full physical board.
- Live browser checks cover wrong-owner rejection, both removals, first capture, optional short versus long capture, all materials, orbit/reset, rotated play, save/reload, 320 px layout, terminal capture and undo/redo. Failed model downloads and WebGL loss both retain a usable 2D position.

Two independent browsers on the local friend runtime completed both removals and a capture from opposite 3D orientations, then reloaded and rejoined the same seat with synchronized boards. The initial audit omitted the existing Join game step after reload; the corrected user flow passed with no runtime errors. This does not certify deployed multiplayer availability.

A production Chrome profile downloaded the pack, saved a rotated porcelain study, closed entirely, and reopened with networking disabled. The native board and preferences restored at 320 px; a three-stone capture and undo/redo worked. The audit found that the web-app manifest was absent from the public pack. It is now hash-verified and cached too. A second fresh profile cold-launched offline, read the manifest with HTTP 200, and rendered the full opening at desktop and 320 px with no runtime or network errors. The final pack contains 90 public assets, 24.7 MiB. Browser screenshots and audit scripts are in ignored `output/playwright/`.

The broader goal remains active: remaining regional collections, complete localization, account friend lists and ratings, referee-certified competitive profiles, physical-device installation and deployed service validation remain separate work. No deployment or remote migration is included.
