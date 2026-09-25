# Compact game studio

## Outcome

The home page now opens with a compact introduction and a visual game library. Eight featured games provide a quick starting point; All games exposes all 20 existing board adapters without the old picker limits. Players can search English names, native names, and aliases, save favorites on their device, and choose bot, local, online, room, or spectator launch modes. Catalog capability gates remain authoritative.

The play screen keeps the board prominent and puts appearance, rotation, rules, and focus controls directly above it. The narrow tools panel wraps its controls instead of clipping them. Time shortcuts and a full-width bot selector make setup easier. Chat is collapsed, and its device-local storage boundary is visible when opened.

## Game-specific presentation

- Distinct artwork and short descriptions for all 20 board games.
- Per-game default palettes, with additional slate and plum looks. Appearance choices persist independently for each variant.
- Xiangqi and Janggi intersection boards with palace diagonals; Xiangqi includes a river gap and label.
- Plain Shogi, Mini Shogi, and Makruk grids, retaining their existing pieces and terrain cues.
- Recognizable chess silhouettes for Crazyhouse, Chaturanga, and Shatranj, including ancient elephant and minister equivalents. Corrected the Xiangqi red horse glyph.
- Last-move markers and legal-move dots. Passes do not highlight a false move; drops highlight only their destination.
- Correct promotion-rank markings for chess, Shogi, Mini Shogi, and Makruk.

## Verification

- Lint, TypeScript, and production build.
- 374 unit/domain/API tests passed. Added regression coverage for piece rendering, the Xiangqi horse glyph, move markers, and promotion ranks.
- Browser traversal of all 20 games: board and piece rendering, legal opening move, undo, and redo availability.
- Six existing end-to-end scenarios passed: checkmate, bot first move when playing black, online queue setup, friend-room setup, read-only spectating, and resign/reset.
- Browser checks for favorites after reload, native-name search, mode-preserving launch links, per-game appearance after reload, focus-mode Escape, and a real classic bot reply.
- Home at 320px and 390px; six representative variant boards at 390px. No horizontal page or assist-control overflow. Dark mode survives reload. Final responsive pass recorded no browser errors.

## Boundaries

This change improves the 20 existing playable board adapters. It does not turn the remaining guide-only catalog entries into new game engines. Online and room end-to-end scenarios use the repository's mocked transport responses; they do not certify the deployed Cloudflare service or a real remote opponent. Existing chat remains local to the device. No production deployment or database migration is included.

Browser screenshots and one-off audit runners live in ignored `output/playwright/`. The application remains available through the usual local development command.
