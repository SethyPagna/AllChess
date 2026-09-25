import { expect, test } from "vitest";
import { createInitialState, applyMove, getLegalMoves, type GameState } from "@/lib/variants";
import { withJanggiFormation } from "@/lib/variants/janggi-formations";
import { encodeLocalMatch, type LocalMatchSnapshot } from "@/lib/game/local-match";
import { exportLocalMatch, importLocalMatch, maxMatchFileBytes } from "@/lib/game/local-match-transfer";
import { botDifficultyLevels } from "@/lib/bot/config";

function snapshot(state: GameState): LocalMatchSnapshot {
  return { state, history: [], future: [], settings: { playMode: "offline", botMode: "human", botDifficulty: botDifficultyLevels[0].key, timeControl: "freestyle", humanColor: state.clocks[0].color, seatChoice: "first", boardOrientation: "auto" } };
}
function rawFile(value: LocalMatchSnapshot) {
  return { format: "allchess-save", version: 1, exportedAt: new Date().toISOString(), game: { id: value.state.id, variantKey: value.state.variantKey, payload: encodeLocalMatch(value) } };
}

test("separate imports keep Janggi formations, redo history, and clocks without reusing any game IDs", () => {
  const start = withJanggiFormation(withJanggiFormation(createInitialState("janggi"), "red", "outer"), "blue", "left");
  const next = applyMove(start, { from: { row: 0, col: 2 }, to: { row: 2, col: 3 } });
  const value = { ...snapshot(start), future: [next] };
  const file = exportLocalMatch(value, new Date("2026-09-25T12:00:00Z"));
  expect(file.filename).toBe("allchess-janggi-2026-09-25.allchess.json");
  const first = importLocalMatch(file.contents), second = importLocalMatch(file.contents);
  expect(new Set([start.id, first.state.id, second.state.id]).size).toBe(3);
  expect(first.future[0].id).toBe(first.state.id);
  expect(first.state.board).toEqual(start.board);
  expect(first.future[0].clocks).toEqual(next.clocks);
  expect(getLegalMoves(first.state, { row: 0, col: 2 })).toEqual(getLegalMoves(start, { row: 0, col: 2 }));
});

test.each(["english-draughts", "international-draughts", "turkish-draughts"])("%s imports crowned pieces absent from the opening setup", key => {
  const state = createInitialState(key), piece = state.board.flat().find(cell => cell.piece)!.piece!;
  piece.code = "x"; piece.promoted = true;
  expect(importLocalMatch(exportLocalMatch(snapshot(state)).contents).state.board).toEqual(state.board);
});

test("rejects damaged files, unknown versions, room credentials, and mismatched game identities", () => {
  const value = rawFile(snapshot(createInitialState("classic")));
  for (const input of ["{", "null", "[]", JSON.stringify({ ...value, version: 2 }), JSON.stringify({ ...value, token: "private-room-token" }), JSON.stringify({ ...value, game: { ...value.game, variantKey: "shogi" } }), JSON.stringify({ ...value, game: { ...value.game, id: "different" } })]) expect(() => importLocalMatch(input)).toThrow();
});

test("rejects oversized files, invalid modes and unknown pieces before saving", () => {
  expect(() => importLocalMatch(" ".repeat(maxMatchFileBytes + 1))).toThrow("16 MB");
  const value = snapshot(createInitialState("classic"));
  const mode = { ...value, settings: { ...value.settings, playMode: "room" } } as unknown as LocalMatchSnapshot;
  expect(() => importLocalMatch(JSON.stringify(rawFile(mode)))).toThrow();
  value.state.board[0][0].piece!.code = "unknown";
  expect(() => importLocalMatch(JSON.stringify(rawFile(value)))).toThrow("unsupported piece");
});

test("rejects damaged counting events instead of crashing after a successful import", () => {
  const value = snapshot(createInitialState("ouk-chaktrang"));
  for (const events of [{}, [null], [{ ply: 0, actor: "white", action: "invented" }]]) {
    value.state.variantState = { oukCountEvents: events };
    expect(() => importLocalMatch(JSON.stringify(rawFile(value)))).toThrow("rule information");
  }
});

test("rejects a tiny reference graph whose rule metadata would expand exponentially", () => {
  const value = snapshot(createInitialState("classic")); value.state.variantState = { metadata: "expand-me" };
  const file = rawFile(value), packed = JSON.parse(file.game.payload);
  const prefix: unknown[] = ["x"];
  for (let i = 1; i < 8; i++) prefix.push({ a: Array(10).fill(i - 1) });
  const offset = prefix.length;
  const shifted = packed.nodes.map((node: { a?: number[]; o?: number[][] } | string | null) => {
    if (node === "expand-me") return { a: Array(10).fill(offset - 1) };
    if (node && typeof node === "object") return node.a ? { a: node.a.map(i => i + offset) } : { o: node.o!.map(pair => pair.map(i => i + offset)) };
    return node;
  });
  file.game.payload = JSON.stringify({ nodes: [...prefix, ...shifted], root: packed.root + offset });
  expect(file.game.payload.length).toBeLessThan(10000);
  expect(() => importLocalMatch(JSON.stringify(file))).toThrow("damaged game");
});

test("the writer rejects the same expanded-size limit before replacing a readable record", () => {
  const state = createInitialState("classic"); state.variantState = { metadata: "x".repeat(1024 * 1024) };
  expect(() => encodeLocalMatch({ ...snapshot(state), history: Array(64).fill(state) })).toThrow("too large to save");
});
