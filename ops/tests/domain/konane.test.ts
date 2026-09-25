import { describe, expect, test } from "vitest";
import { applyMove, createInitialState, getLegalMoves, type GameState } from "@/lib/variants";
import { restoreKonaneOpening, usesKonaneNpsRules } from "@/lib/variants/konane-profile";

function empty() {
  const state = createInitialState("konane");
  state.board.flat().forEach(cell => { cell.piece = null; });
  state.variantState = { ...state.variantState, konaneOpening: { removals: 2 } }; state.ply = 2;
  return state;
}
function put(state: GameState, row: number, col: number, owner: "white" | "black") {
  state.board[row][col].piece = { id: `${owner}-${row}-${col}`, code: "p", owner, labelKey: "chess.pawn" };
}

describe("NPS Kōnane profile", () => {
  test("Black removes first; White may remove a nonadjacent own stone", () => {
    const initial = createInitialState("konane");
    expect(initial.turn).toBe("black"); expect(usesKonaneNpsRules(initial)).toBe(true);
    expect(getLegalMoves(initial, {row:0,col:1})).toEqual([]);
    const black = applyMove(initial, {kind:"remove",from:{row:0,col:0},to:{row:0,col:0}});
    expect(black.turn).toBe("white");
    const white = applyMove(black, {kind:"remove",from:{row:7,col:0},to:{row:7,col:0}});
    expect(white.turn).toBe("black"); expect(white.variantState?.konaneOpening).toMatchObject({removals:2});
    expect(white.board.flat().filter(cell=>cell.piece)).toHaveLength(62);
    expect(white.captured).toHaveLength(0);
  });

  test.each([[0,1],[0,-1],[1,0],[-1,0]])("every straight prefix is selectable in direction %s,%s", (dr,dc) => {
    const state = empty(), from = {row: dr<0 ? 6 : 0, col: dc<0 ? 6 : 0};
    put(state,from.row,from.col,"black");
    for (const step of [1,3,5]) put(state,from.row+dr*step,from.col+dc*step,"white");
    const legal = getLegalMoves(state,from);
    expect(legal.map(move=>move.to)).toEqual([2,4,6].map(step=>({row:from.row+dr*step,col:from.col+dc*step})));
    const before = structuredClone(state);
    const clock = state.clocks.find(clock=>clock.color==="black")!; clock.incrementMs=3000;
    const after = applyMove(state,legal[2]);
    expect(after.captured).toHaveLength(3); expect(after.ply).toBe(3); expect(after.moves).toHaveLength(1);
    expect(after.clocks.find(clock=>clock.color==="black")!.remainingMs).toBe(clock.remainingMs+3000);
    expect(after.board.flat().filter(cell=>cell.piece)).toHaveLength(1);
    expect(after).toMatchObject({status:"completed",result:"black",outcomeReason:"no-legal-moves"});
    expect(state.board).toEqual(before.board);
  });

  test("stopping early ends the turn, while gaps, friendly stones and corners cannot be jumped", () => {
    const state=empty(); put(state,4,0,"black"); put(state,4,1,"white"); put(state,4,3,"white");
    put(state,3,2,"white"); put(state,1,6,"white"); put(state,2,6,"black");
    expect(getLegalMoves(state,{row:4,col:0}).map(move=>move.to)).toEqual([{row:4,col:2},{row:4,col:4}]);
    expect(()=>applyMove(state,{from:{row:4,col:0},to:{row:2,col:2}})).toThrow();
    const short=applyMove(state,{from:{row:4,col:0},to:{row:4,col:2}});
    expect(short.turn).toBe("white"); expect(short.status).toBe("active");
    expect(short.captured).toHaveLength(1); expect(short.board[4][3].piece).not.toBeNull();
    expect(short.variantState?.konaneContinuation).toBeNull();
    state.board[4][3].piece=null;
    expect(getLegalMoves(state,{row:4,col:0})).toHaveLength(1);
    put(state,4,3,"black"); expect(getLegalMoves(state,{row:4,col:0})).toHaveLength(1);
    put(state,4,2,"black"); expect(getLegalMoves(state,{row:4,col:0})).toHaveLength(0);
  });

  test("new and legacy review openings keep their original rules and first mover", () => {
    const initial=createInitialState("konane");
    expect(restoreKonaneOpening(initial,initial)).toBe(initial);
    const legacy=structuredClone(initial); delete legacy.variantState!.konaneProfile;
    const restored=restoreKonaneOpening(initial,legacy);
    expect(restored.turn).toBe("white"); expect(usesKonaneNpsRules(restored)).toBe(false);
    expect(usesKonaneNpsRules(initial)).toBe(true);
    const first=applyMove(restored,{kind:"remove",from:{row:0,col:1},to:{row:0,col:1}});
    expect(()=>applyMove(first,{kind:"remove",from:{row:7,col:7},to:{row:7,col:7}})).toThrow();
  });
});
