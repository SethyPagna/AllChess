"use client";

import { getOukCountChoices, readOukCount, type OukCountAction } from "@/lib/variants/ouk-counting";
import type { GameState, PlayerColor } from "@/lib/variants";
import { oukEndgames, type OukEndgameKey } from "@/lib/variants/ouk-endgames";

export function OukCountingPanel({ state, actor, disabled, localTwoPlayer = false, onAction }: { state: GameState; actor: PlayerColor; disabled: boolean; localTwoPlayer?: boolean; onAction: (action: OukCountAction) => void }) {
  const count = readOukCount(state);
  const choices = getOukCountChoices(state, actor);
  if (localTwoPlayer && count?.phase === "board" && state.status === "active") { choices.stop = true; choices.draw = true; }
  if (!count && !choices.board && !choices.pieces) return null;
  return <section className="ouk-count-panel" aria-label="Cambodian endgame counting">
    <div className="ouk-count-heading"><strong>{count ? `${count.side === "white" ? "White" : "Black"} · ${count.phase === "board" ? "board" : "piece"} count` : "Endgame counting"}</strong>{count ? <span role="status">{count.firstMovePending ? "Starts at " : "Count "}{count.count} / {count.limit}</span> : null}</div>
    <p>{count?.phase === "pieces" ? "Only the escaping king’s moves count. Captures do not reset the limit." : count ? "Your opponent may accept a draw. Stop counting before playing for a win." : "You may claim a count on your turn. Only your moves advance it."}</p>
    <div className="ouk-count-actions">
      {choices.board ? <button type="button" className="focus-ring action-secondary" disabled={disabled} onClick={() => onAction("start-board")}>Start board count · 64</button> : null}
      {choices.pieces ? <button type="button" className="focus-ring action-secondary" disabled={disabled} onClick={() => onAction("start-pieces")}>{count ? "Switch to" : "Start"} piece count · {choices.pieceStart}–{choices.pieceLimit}</button> : null}
      {choices.stop ? <button type="button" className="focus-ring action-secondary" disabled={disabled} onClick={() => onAction("stop")}>Stop counting</button> : null}
      {choices.draw ? <button type="button" className="focus-ring action-secondary" disabled={disabled} onClick={() => onAction("claim-draw")}>Accept counting draw</button> : null}
    </div>
  </section>;
}

export function OukEndgamePicker({ onChoose }: { onChoose: (key: OukEndgameKey) => void }) {
  return <details className="ouk-endgame-picker"><summary className="focus-ring">Practice Cambodian endings</summary><p>Small positions for local study. White moves first.</p><div>{oukEndgames.map(item => <button type="button" className="focus-ring" key={item.key} onClick={() => onChoose(item.key)}><strong>{item.label}</strong><span>{item.detail}</span></button>)}</div></details>;
}
