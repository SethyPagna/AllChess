# Native intersection tabletops — 2026-09-25

Xiangqi and Janggi now have dedicated Blender collections and physical 9×10 intersection boards. Xiangqi has turned wooden discs, river markings and a rosewood case; Janggi has rank-sized octagonal tiles, uninterrupted files and a green lacquer case. Both retain native lettering through material changes, use small unboxed edge coordinates, and support tap moves, board rotation, adjustable angled cameras and offline delivery.

The accompanying Janggi audit corrected Blue Cho's first move, Red Han's identity, palace-centre generals and new-game scoring compensation. Existing saves preserve their earlier scoring profile. Seat ordering is deliberately unchanged because it also defines board orientation and clock labels. See [asset provenance and validation](../../assets/intersection/README.md).

Validation: lint, typecheck, production build, 438 core cases and 73 bot cases (including focused reruns of corrected Janggi expectations), native geometry/grid tests, browser play for both owners, three materials, orbit/zoom/reset, 320/390-pixel layouts, context recovery, and cold offline saved-match play. Cambodia, Classic and Shogi browser regressions pass. Production output has 209 pages and 86 verified offline assets (23.6 MiB).

The broader goal remains active. Native 3D now covers thirteen games. Janggi opening formations and additional tournament profiles, remaining regional collections, physical Shogi hand trays, interface localization, account friend management, device PWA validation, save export/sync and guide-only engines remain open. No production deployment or remote migration is included.
