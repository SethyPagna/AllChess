# Compact secondary pages

History, watch rooms, rankings, profiles, analysis, sign-in and preferences now share compact headings, lighter panels and visual empty states. Guidance stays behind help controls. Actual game results, auth errors and room status remain visible.

## Scope

- History and ranking filters use accessible button choices backed by real GET form values. Native-language search and scope URLs remain intact.
- Watch filters sit above results, with a two-column layout on small screens. Public room links retain spectating and game context.
- Empty rankings use one clear state. All ranking scopes remain reachable in an optional list.
- Profiles distinguish the last result from a best result. Sign-in keeps credential, Google and guest actions in one card with native piece artwork.
- Preferences expose Light, Dark and System as three visible buttons. Notifications no longer manufacture unread events; the empty inbox is explicit. Real notification delivery remains future work.
- Language and notification menus dismiss on outside pointers or Escape; Escape restores trigger focus. Small-screen settings popovers and help stay within viewport edges.
- Unavailable analysis tools are collapsed. Existing reviews expose the complete saved timeline, including moves after ply 16, with metadata in optional details.

## Validation

- Full suite: 654 of 656 tests pass across 78 files. The same two unchanged bot timing checks remain failing: the Elo-band smoke exceeded its 30-second test limit, and the major-piece trade test measured 3,230 ms against 2,800 ms. The dev server and build were stopped during this run; other projects were active on the host. No bot thresholds were changed.
- Development browser checks verify history and ranking GET submissions, dark-theme persistence, System following the OS theme, 320-pixel menu/help bounds, Escape focus restoration and outside-pointer dismissal.
- Lint, TypeScript and production build pass: 209 generated pages and a 43.7 MiB offline pack (119 assets; generated chunk counts vary by build).
- Production Chromium checks all seven pages in light/dark at 320, 390 and 1440 pixels: 42 combinations without page/console errors, document overflow or out-of-bounds panels/controls. Real interactions verify Khmer history search, ranking scope submission, theme persistence and OS following, menu bounds/dismissal/focus, and native required-email validation without submitting credentials.
- Visual review additionally identified stretched empty analysis details; the disclosure now sizes to its contents. Browser artifacts remain in the ignored `output/playwright` directory.

## Remaining work

This increment is part of the active app overhaul. Detailed regional 3D replacements, three coordinated sets per family, full camera/theme coverage, complete localization, physical-device validation and remaining account/friend capabilities are still open. No deployment or merge is included.
