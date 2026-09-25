import { describe, expect, test } from "vitest";
import { applyMove, createInitialState, getLegalMoves } from "@/lib/variants";
import { copyJanggiFormations, janggiFormationKeys, readJanggiFormations, restoreJanggiOpening, withJanggiFormation } from "@/lib/variants/janggi-formations";
import { friendActionSchema, transitionFriendRoom, type FriendAction, type FriendRoom } from "@/lib/realtime/friend-room";
import { createMatchedRoom, hashSeatToken } from "@/lib/realtime/quick-match";
import { encodeLocalMatch, decodeLocalMatch } from "@/lib/game/local-match";
import { botDifficultyLevels } from "@/lib/bot/config";

const red = "11111111-1111-4111-8111-111111111111", blue = "22222222-2222-4222-8222-222222222222", stranger = "33333333-3333-4333-8333-333333333333";
const row = (state: ReturnType<typeof createInitialState>, r: number) => state.board[r].map(cell => cell.piece?.code ?? ".").join("");
async function create(matched = false) {
  if (matched) return createMatchedRoom({ id: "formation-room", variantKey: "janggi", time: "rapid", digests: [await hashSeatToken(red), await hashSeatToken(blue)], createdAt: 1000 });
  return (await transitionFriendRoom(null, "formation-room", { action: "create", variantKey: "janggi", time: "rapid", side: "first", token: red }, 1000)).stored!;
}
async function act(room: FriendRoom, action: FriendAction, now = 2000) { return transitionFriendRoom(room, room.id, action, now); }

describe("Janggi opening formations", () => {
  test("left and right are relative to each player's seat and preserve every piece", () => {
    const original = createInitialState("janggi");
    const next = withJanggiFormation(withJanggiFormation(original, "red", "left"), "blue", "left");
    expect(row(next, 9)).toBe("rhea.aher"); expect(row(next, 0)).toBe("reha.aehr");
    expect(row(original, 9)).toBe("rhea.aehr");
    expect(next.board.flat().filter(cell => cell.piece).map(cell => cell.piece!.id).sort()).toEqual(original.board.flat().filter(cell => cell.piece).map(cell => cell.piece!.id).sort());
    expect(next.board[1][4].piece?.code).toBe("g"); expect(next.board[8][4].piece?.code).toBe("g");
    expect(next.turn).toBe("blue"); expect(next.ply).toBe(0);
  });
  test("all sixteen pairings play, replay and survive saved timeline encoding", () => {
    for (const r of janggiFormationKeys) for (const b of janggiFormationKeys) {
      const opening = withJanggiFormation(withJanggiFormation(createInitialState("janggi"), "red", r), "blue", b);
      const moves = opening.board.flat().flatMap(cell => getLegalMoves(opening, cell.square)).filter(move => move.kind !== "pass");
      expect(moves.length).toBeGreaterThan(0);
      const played = applyMove(opening, moves[0]);
      const replay = applyMove(restoreJanggiOpening(createInitialState("janggi", played.id), played), moves[0]);
      expect(replay.board).toEqual(played.board);
      const payload = encodeLocalMatch({ state: played, history: [opening], future: [], settings: { playMode: "offline", botMode: "human", botDifficulty: botDifficultyLevels[0].key, timeControl: "rapid", humanColor: "red", seatChoice: "first", boardOrientation: "auto" } });
      const saved = decodeLocalMatch({ id: played.id, variantKey: "janggi", version: 1, payload, updatedAt: 1000, revision: 1, ply: 1, completed: false, mode: "offline" });
      expect(saved?.history[0].board).toEqual(opening.board);
      expect(readJanggiFormations(saved!.state)).toEqual({ red: r, blue: b });
      expect(() => withJanggiFormation(played, "red", "inner")).toThrow();
    }
    expect(() => withJanggiFormation(createInitialState("classic"), "red", "inner")).toThrow();
  });
  for (const matched of [false, true]) test(`${matched ? "Quick Match" : "friend rooms"} require ordered confirmations with stopped clocks and idempotent retries`, async () => {
    let room = await create(matched);
    room = (await act(room, { action: "join", token: red })).stored!;
    room = (await act(room, { action: "join", token: blue })).stored!;
    expect(room.state.status).toBe("waiting");
    const clocks = structuredClone(room.state.clocks);
    const redChoice = { action: "formation" as const, token: red, gameId: room.state.id, formation: "outer" as const };
    const blueChoice = { ...redChoice, token: blue, formation: "left" as const };
    expect((await act(room, blueChoice)).status).toBe(409);
    expect((await act(room, { ...redChoice, token: stranger })).status).toBe(403);
    expect((await act(room, { ...redChoice, gameId: "stale" })).status).toBe(409);
    expect((await act(room, { action: "move", token: blue, gameId: room.state.id, version: 0, move: { from: { row: 3, col: 0 }, to: { row: 4, col: 0 } } })).status).toBe(409);
    room = (await act(room, redChoice, 10000)).stored!;
    expect(room.janggiSetup).toEqual({ red: "outer" }); expect(room.state.status).toBe("waiting");
    expect((await act(room, { ...redChoice, formation: "right" })).status).toBe(409);
    const retried = await act(room, redChoice, 11000); expect(retried.status).toBe(200); room = retried.stored!;
    room = (await act(room, blueChoice, 20000)).stored!;
    expect(room.state.status).toBe("active"); expect(room.state.turn).toBe("blue"); expect(room.arrival).toBeUndefined();
    expect(room.state.clocks).toEqual(clocks);
    const snapshot = structuredClone(room.state.board);
    room = (await act(room, blueChoice, 21000)).stored!;
    expect(room.state.board).toEqual(snapshot); expect(room.state.clocks.find(clock => clock.color === "blue")?.remainingMs).toBe(599000);
    expect((await act(room, { ...blueChoice, formation: "right" }, 22000)).status).toBe(409);
    room = (await act(room, { action: "resign", token: red, gameId: room.state.id }, 22000)).stored!;
    const previous = room.state.id;
    room = (await act(room, { action: "rematch", token: red, gameId: previous }, 23000)).stored!;
    room = (await act(room, { action: "rematch", token: blue, gameId: previous }, 24000)).stored!;
    expect(room.state.id).not.toBe(previous); expect(room.state.status).toBe("waiting"); expect(room.janggiSetup).toEqual({});
    expect(room.seats.find(seat => seat.digest)?.color).toBe("blue");
    expect((await act(room, { ...redChoice, gameId: room.state.id }, 25000)).status).toBe(409);
    if (matched) expect(room.arrival?.deadline).toBe(84000);
  });
  test("closed matches cannot finish setup, including after serialized storage restoration", async () => {
    const room = await create(true);
    const restored = JSON.parse(JSON.stringify(room));
    const result = await act(restored, { action: "formation", token: red, gameId: room.state.id, formation: "outer" }, 61000);
    expect(result.status).toBe(409); expect(result.stored?.arrival?.status).toBe("expired"); expect(result.stored?.janggiSetup).toEqual({});
  });
  test("Cho confirmation cannot revive an expired or cancelled match", async () => {
    for (const cancelled of [false, true]) {
      let room = await create(true);
      room = (await act(room, { action: "join", token: red })).stored!;
      room = (await act(room, { action: "join", token: blue })).stored!;
      room = (await act(room, { action: "formation", token: red, gameId: room.state.id, formation: "outer" })).stored!;
      if (cancelled) room = (await act(room, { action: "leave-before-start", token: red, gameId: room.state.id }, 3000)).stored!;
      const result = await act(room, { action: "formation", token: blue, gameId: room.state.id, formation: "left" }, cancelled ? 4000 : 61000);
      expect(result.status).toBe(409); expect(result.stored?.state.status).toBe("waiting");
      expect(result.stored?.janggiSetup).toEqual({ red: "outer" }); expect(result.stored?.state.result).toBeUndefined();
    }
  });
  test("old rooms and their scoring policy remain playable without a new setup phase", async () => {
    let room = await create(); delete room.janggiSetup; delete room.state.variantState;
    room = (await act(room, { action: "join", token: blue })).stored!;
    expect(room.state.status).toBe("active");
    expect(restoreJanggiOpening(createInitialState("janggi"), room.state).variantState?.janggiProfile).toBeUndefined();
    expect(copyJanggiFormations(createInitialState("janggi"), room.state).variantState?.janggiProfile).toBe("cho-first-v1");
  });
  test("invalid formation names are rejected at the request boundary", () => {
    expect(friendActionSchema.safeParse({ action: "formation", gameId: "game", token: red, formation: "random-layout" }).success).toBe(false);
  });
});
