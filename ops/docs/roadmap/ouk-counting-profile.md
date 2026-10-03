# Cambodian counting and endgame practice

## Rules profile and sources

AllChess implements the published [PyChess digital Ouk Chaktrang profile](https://www.pychess.org/variants/cambodian). The [Cambodia federation's 2022 championship regulations](https://docs.google.com/document/d/1adppJ66vonM27UYwC-KyldXl7oZ_5Pb0/edit), Article 5, corroborate the material limits and bare-king priority. The downloaded document's SHA-256 was `3482bfa82273b5bb6e498e28470176101b8f11e3acbfeb24e364a85f31701aa6`. The source document remains outside the committed repository.

A player with at most three pieces may claim a board count on their turn. Their first subsequent move announces 1; only their moves advance toward 64. They can stop, and a later board claim starts afresh. The opposing player can accept a draw during that count. A claimant who mates without stopping the board count receives a draw.

A bare king may choose piece counting when neither side has unpromoted pawns. Its first move announces total remaining pieces plus one. The shortest applicable chasing-material limit is used: two rooks 8, one rook 16, two generals 22, two horses 32, one general 44, otherwise 64. The piece limit and starting count do not change after captures. Piece counting cannot be stopped/restarted to extend survival. A bare king has priority to replace a board count.

The first-move convention is explicit: in the two-rooks-versus-king exercise, the king counts 5, 6, 7, 8 on four moves. The draw happens on its fourth move; the chasing side gets no extra reply after the limit. A board count reaches 64 after 64 claimant moves, not 64 total plies.

The championship translation also delegates repetition/capture and other disputes to referees. AllChess does not silently combine those tournament clauses with the digital profile or claim federation certification. These interpretations and online/bot verification remain catalog gates.

The opening-rule audit also removed an overrestriction: a resolved non-rook check does not by itself revoke an unmoved king's leap. Current check still prevents a leap, and rook alignment permanently removes the right. This matches the published rule and the rook-specific rights handling in [Fairy-Stockfish](https://github.com/fairy-stockfish/Fairy-Stockfish/blob/master/src/position.cpp).

## Implementation

- Counting is a separate state action and consumes neither a board move nor a clock increment. Claim, stop, and acceptance events are retained with their ply in variant state. Legal moves advance the count and adjudicate the result.
- State snapshots preserve counting through undo, redo, review, and JSON serialization. The bot search key already includes variant state, keeping counted and uncounted positions distinct.
- Defending bots choose the shorter available count. A mate-in-one check prevents starting a board count over a winning move and stops an existing own board count before taking that win.
- Three legal teaching positions are available from setup: escaping two boats, board-count practice, and the counter-mate rule. Changing the clock preserves the selected exercise.
- The panel appears only in relevant endgames. Local players can stop or accept the count without waiting for their turn; bot play restricts controls to the human's side.
- Result explanations distinguish an expired count, an accepted counting draw, and a claimant's counter-mate. The shared result dialog now uses the browser top layer, a compact explanation, expandable details, bounded scrolling, focus cycling, and Escape dismissal.

## Validation

- Lint, TypeScript, and production build; 369 current unit/domain/API cases passed, with the separate general bot suite excluded from this run. Four of the current cases specifically exercise Cambodian bot behavior.

- Domain cases cover all material limits and mixed material, claim eligibility, both phases, first-move timing, a complete 127-ply board count, fixed limits after captures, stop/restart, bare-king priority, draw acceptance, counter-mate, and checkmate before the deadline.
- Bot checks cover opening and counted endgame moves at four difficulty anchors, distinct cache keys, preservation of nearly completed board counts, and avoiding a count over mate.
- Browser exercises cover counted draws, stopped-count wins, counter-mate draws, automatic bot claims, undo/redo, and preserving an exercise when changing clocks.
- Expanded result dialogs fit 320×640, 568×320, and 390×844 screens; Tab remains within the dialog and Escape closes it. Existing classic checkmate and resignation/reset scenarios also pass.

During verification, a stale development CSS bundle was detected by comparing computed styles with source and resolved by restarting the local server. Production build and development preview should not share active build artifacts during visual checks.
