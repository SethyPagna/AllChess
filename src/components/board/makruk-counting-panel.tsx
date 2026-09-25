"use client";

import { getMakrukCountChoices, readMakrukHonorCount, usesMakrukHonorCount, type MakrukCountAction } from "@/lib/variants/makruk-counting";
import { makrukEndgames, type MakrukEndgameKey } from "@/lib/variants/makruk-endgames";
import type { GameState, PlayerColor } from "@/lib/variants";

export function MakrukCountingPanel({ state, actor, disabled, localTwoPlayer, onAction }: { state: GameState; actor: PlayerColor; disabled: boolean; localTwoPlayer: boolean; onAction: (action: MakrukCountAction) => void }) {
  const count = readMakrukHonorCount(state), choices = getMakrukCountChoices(state, actor);
  if (!usesMakrukHonorCount(state)) return <section className="ouk-count-panel" aria-label="Makruk legacy counting"><p>This saved game uses the earlier automatic counting rules. Start a new game for honor counting.</p></section>;
  if (localTwoPlayer && count?.phase === "board" && state.status === "active") { choices.stop = true; choices.draw = true; }
  if (!count && !choices.board) return null;
  return <section className="ouk-count-panel" aria-label="Makruk honor counting">
    <div className="ouk-count-heading"><strong>{count ? `${count.side === "white" ? "White" : "Black"} · ${count.phase === "board" ? "board" : "piece"} honor` : "Board's honor"}</strong>{count ? <span role="status">{count.firstMovePending ? "Starts at " : "Count "}{count.count} / {count.limit}</span> : null}</div>
    <p>{count?.phase === "pieces" ? `Only the escaping king's moves count. The limit stays fixed; count ${count.limit + 1} draws.` : count ? "Only the counting player's moves count. Stop before playing for a win; the opponent may accept a draw." : "No unpromoted pawns remain. If you are playing for a draw, you may start counting your moves."}</p>
    <div className="ouk-count-actions">
      {choices.board ? <button type="button" className="focus-ring action-secondary" disabled={disabled} onClick={() => onAction("start-board")}>Start board count · 64</button> : null}
      {choices.stop ? <button type="button" className="focus-ring action-secondary" disabled={disabled} onClick={() => onAction("stop")}>Stop counting</button> : null}
      {choices.draw ? <button type="button" className="focus-ring action-secondary" disabled={disabled} onClick={() => onAction("claim-draw")}>Accept counting draw</button> : null}
    </div>
  </section>;
}

export function MakrukEndgamePicker({ onChoose }: { onChoose: (key: MakrukEndgameKey) => void }) {
  return <details className="ouk-endgame-picker"><summary className="focus-ring">Practice Thai endings</summary><p>Small positions for local study. White moves first.</p><div>{makrukEndgames.map(item => <button type="button" className="focus-ring" key={item.key} onClick={() => onChoose(item.key)}><strong>{item.label}</strong><span>{item.detail}</span></button>)}</div></details>;
}
