import { describe, expect, test } from "vitest";
import { applyMove, createInitialState, getLegalMoves, variantCatalog, type GameState } from "@/lib/variants";
import { applyOukCountAction, readOukCount } from "@/lib/variants/ouk-counting";
import { createOukEndgame } from "@/lib/variants/ouk-endgames";
import { createMakrukEndgame } from "@/lib/variants/makruk-endgames";
import { applyMakrukCountAction, readMakrukHonorCount } from "@/lib/variants/makruk-counting";
import { decodeLocalMatch, encodeLocalMatch, type LocalMatchRecord, type LocalMatchSnapshot } from "@/lib/game/local-match";
import { botDifficultyLevels } from "@/lib/bot/config";
import { exportLocalMatch, importLocalMatch } from "@/lib/game/local-match-transfer";

function snapshot(state: GameState, history: GameState[] = [], future: GameState[] = []): LocalMatchSnapshot {
  return { state, history, future, settings: { playMode: "offline", botMode: "human", botDifficulty: botDifficultyLevels[0].key, timeControl: "rapid", humanColor: state.clocks[0].color, seatChoice: "random", boardOrientation: "second" } };
}
function record(value: LocalMatchSnapshot): LocalMatchRecord {
  return { id: value.state.id, variantKey: value.state.variantKey, updatedAt: 1, revision: 1, ply: value.state.ply, completed: value.state.status === "completed", mode: value.settings.playMode, version: 1, payload: encodeLocalMatch(value) };
}
function roundtrip(value: LocalMatchSnapshot) {
  const restored = decodeLocalMatch(record(value));
  expect(restored).toEqual(JSON.parse(JSON.stringify(value)));
  const imported = importLocalMatch(exportLocalMatch(value).contents);
  const copied = JSON.parse(JSON.stringify(value)) as LocalMatchSnapshot;
  for (const frame of [...copied.history, copied.state, ...copied.future]) frame.id = imported.state.id;
  expect(imported).toEqual(copied);
  expect(imported.state.id).not.toBe(value.state.id);
  return restored!;
}

describe("saved local matches", () => {
  test("Makruk honor claims, fixed limits and legacy profiles survive undo/redo snapshots", () => {
    for (const key of ["two-rooks", "board-honor"] as const) {
      let start = createMakrukEndgame(key);
      if (key === "board-honor") start = applyMakrukCountAction(start, "white", "start-board");
      const next = applyMove(start, { from: { row: 7, col: 0 }, to: { row: 7, col: 1 } });
      const saved = roundtrip(snapshot(next, [start]));
      expect(readMakrukHonorCount(saved.state)).toMatchObject({ firstMovePending: false, count: key === "two-rooks" ? 5 : 1 });
      expect(saved.state.variantState?.makrukCountEvents).toEqual(start.variantState?.makrukCountEvents);
      roundtrip(snapshot(start, [], [next]));
    }
    const legacy = createInitialState("makruk"); delete legacy.variantState;
    expect(roundtrip(snapshot(legacy)).state.variantState).toBeUndefined();
  });
  test.each(variantCatalog.map(variant => variant.key))("%s preserves positions, clocks and undo/redo across legal moves", key => {
    let state = createInitialState(key); const timeline = [state];
    for (let i = 0; i < 10 && state.status === "active"; i++) {
      const legal = state.board.flatMap(row => row.flatMap(cell => cell.piece?.owner === state.turn ? getLegalMoves(state, cell.square) : []));
      if (!legal.length) break;
      state = applyMove(state, legal[i % legal.length]); timeline.push(state);
    }
    const cursor = Math.floor((timeline.length - 1) / 2);
    const value = snapshot(timeline[cursor], timeline.slice(0, cursor), timeline.slice(cursor + 1));
    value.state = { ...value.state, clocks: value.state.clocks.map(clock => ({ ...clock, remainingMs: clock.remainingMs - 1234 })) };
    const restored = roundtrip(value);
    for (const cell of restored.state.board.flat()) if (cell.piece?.owner === restored.state.turn) expect(getLegalMoves(restored.state, cell.square)).toEqual(getLegalMoves(value.state, cell.square));
  });

  test("Cambodia's claims and opening restrictions survive without replaying them away", () => {
    const start = applyOukCountAction(createOukEndgame("two-rooks"), "white", "start-pieces");
    const next = applyMove(start, { from: { row: 7, col: 0 }, to: { row: 7, col: 1 } });
    const restored = roundtrip(snapshot(next, [start]));
    expect(readOukCount(restored.state)).toMatchObject({ count: 5, firstMovePending: false });
    expect(restored.state.variantState?.oukLeapUsed).toEqual(start.variantState?.oukLeapUsed);
    expect(restored.history[0].variantState?.oukCountEvents).toEqual(start.variantState?.oukCountEvents);
  });

  test("preserves promoted pieces, pieces in hand, and a legal shogi drop", () => {
    let state = createInitialState("shogi");
    state.hands!.sente = { g: 1 }; state.board[6][0].piece!.promoted = true;
    const drop = { id: "sente-g-hand", owner: "sente" as const, code: "g", labelKey: "g" };
    const move = getLegalMoves(state, { drop }).find(candidate => candidate.to.row === 4 && candidate.to.col === 3)!;
    const start = state; state = applyMove(state, move);
    const restored = roundtrip(snapshot(state, [start]));
    expect(restored.state.hands?.sente?.g ?? 0).toBe(0);
    expect(restored.state.board[4][3].piece?.code).toBe("g");
    expect(restored.history[0].board[6][0].piece?.promoted).toBe(true);
  });

  test("preserves results and compresses a long review timeline", () => {
    let state = createOukEndgame("board-honor"); const history: GameState[] = [];
    for (let i = 0; i < 80; i++) {
      history.push(state);
      const white = state.turn === "white";
      const column = (Math.floor(i / 2) % 2) + (white ? 0 : 5);
      state = applyMove(state, { from: { row: white ? 7 : 1, col: column }, to: { row: white ? 7 : 1, col: (Math.floor(i / 2) % 2 ? -1 : 1) + column } });
    }
    state = { ...state, status: "completed", result: "draw", outcomeReason: "draw" };
    const saved = snapshot(state, history);
    expect(encodeLocalMatch(saved).length).toBeLessThan(JSON.stringify(saved).length / 4);
    roundtrip(saved);
  });

  test("restores the mandatory next jump in a partially completed capture", () => {
    const state = createInitialState("english-draughts");
    state.board.forEach(row => row.forEach(cell => { cell.piece = null; }));
    for (const [row, col, owner] of [[5, 0, "white"], [5, 4, "white"], [4, 1, "black"], [2, 3, "black"]] as const) state.board[row][col].piece = { id: `${owner}-${row}-${col}`, code: "p", owner, labelKey: "chess.pawn" };
    const halfway = applyMove(state, { from: { row: 5, col: 0 }, to: { row: 3, col: 2 } });
    const restored = roundtrip(snapshot(halfway, [state])).state;
    expect(restored.turn).toBe("white");
    expect(getLegalMoves(restored, { row: 5, col: 4 })).toEqual([]);
    const nextJump = getLegalMoves(restored, { row: 3, col: 2 });
    expect(nextJump).toEqual([{ from: { row: 3, col: 2 }, to: { row: 1, col: 4 } }]);
    expect(applyMove(restored, nextJump[0]).captured).toHaveLength(2);
  });

  test("keeps history-dependent castling restrictions and en passant", () => {
    let state = createInitialState("classic"); state.board[7][5].piece = null; state.board[7][6].piece = null;
    const history: GameState[] = [];
    for (const [fr, fc, tr, tc] of [[7, 4, 7, 5], [1, 0, 2, 0], [7, 5, 7, 4], [2, 0, 3, 0]]) { history.push(state); state = applyMove(state, { from: { row: fr, col: fc }, to: { row: tr, col: tc } }); }
    const restored = roundtrip(snapshot(state, history)).state;
    expect(getLegalMoves(restored, { row: 7, col: 4 })).not.toContainEqual({ from: { row: 7, col: 4 }, to: { row: 7, col: 6 } });
    state = createInitialState("classic"); history.length = 0;
    for (const [fr, fc, tr, tc] of [[6, 4, 4, 4], [1, 0, 2, 0], [4, 4, 3, 4], [1, 3, 3, 3]]) { history.push(state); state = applyMove(state, { from: { row: fr, col: fc }, to: { row: tr, col: tc } }); }
    const enPassant = roundtrip(snapshot(state, history)).state;
    expect(getLegalMoves(enPassant, { row: 3, col: 4 })).toContainEqual({ from: { row: 3, col: 4 }, to: { row: 2, col: 3 } });
  });

  test("refuses an oversized timeline before replacing a readable save", () => {
    const state = createInitialState("classic");
    expect(() => encodeLocalMatch(snapshot(state, Array(2048).fill(state)))).toThrow("timeline limit");
  });

  test("rejects malformed, cross-game, and unsupported-version saves", () => {
    const saved = record(snapshot(createInitialState("classic")));
    expect(decodeLocalMatch({ ...saved, payload: "{" })).toBeNull();
    expect(decodeLocalMatch({ ...saved, version: 2 } as unknown as LocalMatchRecord)).toBeNull();
    expect(decodeLocalMatch({ ...saved, variantKey: "shogi" })).toBeNull();
    expect(decodeLocalMatch({ ...saved, id: "different-game" })).toBeNull();
    const invalid = snapshot(createInitialState("classic")); invalid.state.board[0][0].square.col = 90;
    expect(decodeLocalMatch(record(invalid))).toBeNull();
    expect(decodeLocalMatch({ ...saved, payload: JSON.stringify({ nodes: [{ a: [0] }], root: 0 }) })).toBeNull();
  });
});
