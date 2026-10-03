import { describe, expect, test } from "vitest";
import { friendActionSchema, transitionFriendRoom, type FriendRoom } from "@/lib/realtime/friend-room";
import { moveKindAllowed } from "@/lib/realtime/move-request";
import { applyAuthoritativeRoomMove, createRoomSnapshot } from "@/lib/realtime/rooms";
import { createInitialState, getLegalMoves, type Move } from "@/lib/variants";

const host = "11111111-1111-4111-8111-111111111111";
const guest = "22222222-2222-4222-8222-222222222222";
const sq = (row: number, col: number) => ({ row, col });

async function room(variantKey: string) {
  const created = await transitionFriendRoom(null, `${variantKey}-room`, { action: "create", token: host, variantKey, time: "freestyle", side: "first" }, 1000);
  return (await transitionFriendRoom(created.stored, `${variantKey}-room`, { action: "join", token: guest }, 2000)).stored!;
}

function mover(stored: FriendRoom) {
  return stored.seats[0].color === stored.state.turn ? host : guest;
}

function firstCandidate(stored: FriendRoom): Move {
  for (const cell of stored.state.board.flat()) {
    if (cell.piece?.owner !== stored.state.turn) continue;
    const [candidate] = getLegalMoves(stored.state, cell.square);
    if (candidate) return candidate;
  }
  throw new Error("no legal move");
}

function moveAction(stored: FriendRoom, move: Move) {
  return { action: "move" as const, token: mover(stored), gameId: stored.state.id, version: stored.state.ply, move };
}

describe("friend and quick-match rooms reject move kinds the variant does not define", () => {
  test.each(["classic", "antichess", "xiangqi", "english-draughts"])("%s rejects a legal move relabelled as a removal", async (variantKey) => {
    const stored = await room(variantKey);
    expect(stored.state.status).toBe("active");
    const candidate = firstCandidate(stored);
    const before = structuredClone(stored.state);
    for (const move of [{ ...candidate, kind: "remove" as const }, { kind: "remove" as const, from: candidate.from, to: candidate.from }]) {
      const result = await transitionFriendRoom(structuredClone(stored), `${variantKey}-room`, moveAction(stored, move), 3000);
      expect(result.status).toBe(400);
      expect(result.stored?.state.board).toEqual(before.board);
      expect(result.stored?.state.moves).toHaveLength(0);
    }
    expect((await transitionFriendRoom(stored, `${variantKey}-room`, moveAction(stored, candidate), 3000)).status).toBe(200);
  });

  test("Konane removals still apply and a kind-less removal is rejected", async () => {
    const stored = await room("konane");
    const kindless = await transitionFriendRoom(structuredClone(stored), "konane-room", moveAction(stored, { from: sq(0, 0), to: sq(0, 0) }), 3000);
    expect(kindless.status).toBe(400);
    const removed = await transitionFriendRoom(stored, "konane-room", moveAction(stored, { kind: "remove", from: sq(0, 0), to: sq(0, 0) }), 3000);
    expect(removed.status).toBe(200);
    expect(removed.stored!.state.moves.at(-1)?.kind).toBe("remove");
    expect(removed.stored!.state.variantState?.konaneOpening).toMatchObject({ removals: 1 });
  });

  test("the move schema requires a removal to name one square and a drop to name its piece", () => {
    const parse = (move: Record<string, unknown>) => friendActionSchema.safeParse({ action: "move", token: host, gameId: "g", version: 0, move }).success;
    expect(parse({ kind: "remove", from: sq(0, 0), to: sq(0, 0) })).toBe(true);
    expect(parse({ kind: "remove", from: sq(6, 4), to: sq(4, 4) })).toBe(false);
    expect(parse({ kind: "drop", from: sq(-1, -1), to: sq(4, 4) })).toBe(false);
    expect(parse({ from: sq(6, 4), to: sq(4, 4) })).toBe(true);
  });

  test("only Konane accepts kind remove", () => {
    expect(moveKindAllowed("konane", "remove")).toBe(true);
    for (const variantKey of ["classic", "antichess", "xiangqi", "janggi", "english-draughts"]) expect(moveKindAllowed(variantKey, "remove")).toBe(false);
    expect(moveKindAllowed("classic", undefined)).toBe(true);
    expect(moveKindAllowed("crazyhouse", "drop")).toBe(true);
  });

  test("authoritative rooms reject removals outside Konane", () => {
    const classic = createRoomSnapshot({ state: createInitialState("classic") });
    expect(applyAuthoritativeRoomMove(classic, { kind: "remove", from: sq(6, 4), to: sq(6, 4) }).ok).toBe(false);
    const konane = createRoomSnapshot({ state: createInitialState("konane") });
    expect(applyAuthoritativeRoomMove(konane, { kind: "remove", from: sq(0, 0), to: sq(0, 0) }).ok).toBe(true);
  });
});
