# Visual discovery and camera acceptance

The active goal covers all 21 playable games and every app page. Completion requires at least three coordinated sets per native game family, individually generated image masters, detailed textured GLBs, editable Blender sources and provenance. Playable coverage is not an art-quality verdict.

Camera presentation is a first-class acceptance criterion: adjustable angled views, physical scale, convincing light and shadow, readable silhouettes and ownership, clean framing without clipping or wasted space, subtle unboxed edge coordinates, and intuitive orbit, zoom and reset. Inspect every game/theme at playing size and from multiple angles. Preserve customization during resize and prevent camera gestures from making moves.

## Discovery increment

- Home, lobby, catalog and playable guide headers share native piece artwork. Short titles and actions replace repeated descriptive card copy. Guide-only entries use a book illustration and remain explicitly labelled.
- Cambodia appears in the lobby's featured games with its existing local-preview status. Lobby, catalog and guide links follow per-mode availability; this does not unlock online modes. Board previews distinguish plain regional grids, intersection boards, Jungle terrain and Kōnane bowls.
- Catalog filters use visible selections and real buttons. Native-language search retains Unicode letters, numbers and marks, including Khmer and Thai.
- Guide overlays use native modal dialogs for focus containment, Escape and focus restoration. Basics remain visible; endings, modes, provenance and training details are available on demand. Rules gates remain visible, using concise player-facing copy. Duplicate English/romanized names are removed.
- Bot internals and lobby totals sit in closed disclosures. Existing navigation, mode links, statuses and accessible labels remain available.

## Validation

- Lint, TypeScript and the production build pass (209 generated pages; the offline manifest still has 120 public assets, 43.7 MiB).
- All 32 focused page, catalog and documentation regressions pass, including the new check that Cambodia exposes its local preview without claiming online readiness.
- Production Chromium checks home, lobby, catalog and the Cambodian guide in light and dark at 320, 390 and 1440 pixels: 24 route/theme/viewport combinations, no runtime errors or cards outside the viewport. Screenshots are reviewed at browsing size.
- Actual interactions verify Khmer and Thai search, family selection with real buttons at 320 pixels, modal keyboard containment, Escape and focus restoration. Native modal keyboard traversal may enter browser chrome, but does not activate the underlying page.
- The full suite passed 648 of 655 cases while a production build ran alongside it. Seven unchanged bot-search timing/cache tests failed. An isolated rerun passed five; two latency assertions remain failing (3,347 ms and 3,268 ms against a 2,800 ms limit). No bot implementation or test threshold was changed. These failures remain open under the broader goal; this is not an all-green suite claim.

## Remaining work

This is a discovery-page increment, not the completed app overhaul. Remaining pages need a coordinated density and interaction pass. Native 3D replacements, multiple distinct sets per family, theme/camera coverage, full localization, physical-device validation and remaining friend/account capabilities are still open. The final guide layout uses one accordion column to avoid empty grid space. Existing gameplay, save and room protocols are unchanged by this increment. No deployment or merge is included.
