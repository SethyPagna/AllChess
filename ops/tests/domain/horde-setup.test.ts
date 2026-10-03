import { describe, expect, test } from "vitest";
import { applyMove, createInitialState, getLegalMoves, type GameState, type Move, type Square } from "@/lib/variants";
import { LEGACY_HORDE_SETUP, restoreHordeOpening, usesLichessHordeSetup } from "@/lib/variants/horde-profile";

const LICHESS_HORDE = ["rnbqkbnr", "pppppppp", "........", ".PP..PP.", "PPPPPPPP", "PPPPPPPP", "PPPPPPPP", "PPPPPPPP"];

const at = (name: string): Square => ({ row: 8 - Number(name[1]), col: name.charCodeAt(0) - 97 });
const uci = (move: Move) => [move.from, move.to].map(({ row, col }) => `${String.fromCharCode(97 + col)}${8 - row}`).join("");
const rows = (state: GameState) => state.board.map((row) => row.map(({ piece }) => !piece ? "." : piece.owner === "white" ? piece.code.toUpperCase() : piece.code).join(""));
const targets = (state: GameState, from: string) => getLegalMoves(state, at(from)).map(uci);

function hordeBoard(pieces: Record<string, string>, turn: "white" | "black" = "white") {
  const state = createInitialState("horde", "horde-fixture");
  state.board.forEach((row) => row.forEach((cell) => { cell.piece = null; }));
  for (const [name, token] of Object.entries(pieces)) {
    const { row, col } = at(name), owner = token === token.toUpperCase() ? "white" : "black", code = token.toLowerCase();
    state.board[row][col].piece = { id: `${owner}-${code}-${name}`, code, owner, labelKey: code };
  }
  state.turn = turn;
  return state;
}

describe("horde (Lichess setup)", () => {
  test("starts from rnbqkbnr/pppppppp/8/1PP2PP1/PPPPPPPP/PPPPPPPP/PPPPPPPP/PPPPPPPP with 36 pawns and 8 legal moves", () => {
    const state = createInitialState("horde", "horde-start");
    expect(rows(state)).toEqual(LICHESS_HORDE);
    expect(state.board.flat().filter(({ piece }) => piece?.owner === "white" && piece.code === "p")).toHaveLength(36);

    const moves = state.board.flat().filter(({ piece }) => piece?.owner === "white").flatMap(({ square }) => getLegalMoves(state, square)).map(uci);
    expect(moves.sort()).toEqual(["a4a5", "b5b6", "c5c6", "d4d5", "e4e5", "f5f6", "g5g6", "h4h5"]);
  });

  test("black keeps both the single and double step from d7", () => {
    const state = applyMove(createInitialState("horde", "horde-black-pawn"), { from: at("a4"), to: at("a5") });
    expect(targets(state, "d7").sort()).toEqual(["d7d5", "d7d6"]);
  });

  test("a first-rank horde pawn may advance two squares only through empty squares", () => {
    expect(targets(hordeBoard({ e1: "P", e8: "k" }), "e1").sort()).toEqual(["e1e2", "e1e3"]);
    expect(targets(hordeBoard({ e1: "P", e2: "P", e8: "k" }), "e1")).toEqual([]);
    expect(targets(hordeBoard({ e1: "P", e3: "p", e8: "k" }), "e1")).toEqual(["e1e2"]);
  });

  test("a played first-rank double step gives no en passant right, while a second-rank one does", () => {
    const fromFirst = applyMove(hordeBoard({ e1: "P", d3: "p", e8: "k" }), { from: at("e1"), to: at("e3") });
    expect(targets(fromFirst, "d3")).not.toContain("d3e2");

    const fromSecond = applyMove(hordeBoard({ e2: "P", d4: "p", e8: "k" }), { from: at("e2"), to: at("e4") });
    expect(targets(fromSecond, "d4")).toContain("d4e3");
    expect(rows(applyMove(fromSecond, { from: at("d4"), to: at("e3") }))[4]).toBe("........");
  });

  test("friend-room replays restore the legacy 32-pawn opening for unversioned games", () => {
    const initial = createInitialState("horde", "horde-room");
    expect(usesLichessHordeSetup(initial)).toBe(true);
    expect(usesLichessHordeSetup(applyMove(initial, { from: at("e4"), to: at("e5") }))).toBe(true);
    expect(restoreHordeOpening(initial, initial)).toBe(initial);

    const legacyRoom: GameState = { ...initial };
    delete legacyRoom.variantState;
    const replay = restoreHordeOpening(createInitialState("horde", "horde-room"), legacyRoom);
    expect(rows(replay)).toEqual(LEGACY_HORDE_SETUP);
    expect(replay.variantState).toBeUndefined();
    expect(rows(applyMove(replay, { from: at("e5"), to: at("e6") }))[2]).toBe("....P...");
  });
});
