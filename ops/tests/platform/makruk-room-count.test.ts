import { expect, test } from "vitest";
import { friendActionSchema, transitionFriendRoom, type FriendRoom } from "@/lib/realtime/friend-room";
import { createMakrukEndgame } from "@/lib/variants/makruk-endgames";
import { readMakrukHonorCount } from "@/lib/variants/makruk-counting";

const host = "11111111-1111-4111-8111-111111111111", guest = "22222222-2222-4222-8222-222222222222", other = "33333333-3333-4333-8333-333333333333";
async function room() {
  const created = await transitionFriendRoom(null, "makruk-room", { action: "create", token: host, variantKey: "makruk", time: "freestyle", side: "first" }, 1000);
  const joined = await transitionFriendRoom(created.stored, "makruk-room", { action: "join", token: guest }, 1000);
  const room = joined.stored!; room.state = createMakrukEndgame("board-honor"); room.state.id = "count-game";
  return room;
}
const count = (room: FriendRoom, token: string, countAction: "start-board" | "stop" | "claim-draw", countVersion = 0, version = 0) => transitionFriendRoom(room, room.id, { action: "count", token, gameId: room.state.id, countAction, countVersion, version }, 1000);

test("room honor claims require a seated eligible player and current count version", async () => {
  const original = await room();
  expect((await count(original, other, "start-board")).status).toBe(403);
  expect((await count(original, guest, "start-board")).status).toBe(400);
  expect((await count(original, host, "start-board", 0, 1)).status).toBe(409);
  const started = await count(original, host, "start-board"); expect(started.status).toBe(200);
  expect(readMakrukHonorCount(started.body.room!.state)).toMatchObject({ phase: "board", side: "white", count: 1 });
  expect((await count(started.stored!, host, "start-board")).status).toBe(409);
  expect((await count(started.stored!, host, "stop")).status).toBe(409);
  expect((await count(started.stored!, guest, "stop", 1)).status).toBe(400);
  const read = await transitionFriendRoom(started.stored, original.id, { action: "read", token: host }, 1000);
  expect((await count(read.stored!, host, "stop", 1)).status).toBe(200);
});

test("room claims reject stale moves and allow only the chaser to accept a counting draw", async () => {
  const started = (await count(await room(), host, "start-board")).stored!;
  const action = { action: "move" as const, token: host, gameId: started.state.id, version: 0, countVersion: 0, move: { from: { row: 7, col: 0 }, to: { row: 7, col: 1 } } };
  expect((await transitionFriendRoom(started, started.id, action, 1000)).status).toBe(409);
  const moved = await transitionFriendRoom(started, started.id, { ...action, countVersion: 1 }, 1000);
  expect(moved.status).toBe(200); expect(readMakrukHonorCount(moved.stored!.state)?.firstMovePending).toBe(false);
  expect((await count(moved.stored!, host, "claim-draw", 1, 1)).status).toBe(400);
  const finished = await count(moved.stored!, guest, "claim-draw", 1, 1);
  expect(finished.body.room!.state).toMatchObject({ result: "draw", outcomeReason: "counting-rule" });
  expect((await count(finished.stored!, host, "stop", 2, 1)).status).toBe(409);
});

test("count protocol validates actions and rejects a previous game's claim", async () => {
  expect(friendActionSchema.safeParse({ action: "count", token: host, gameId: "count-game", version: 0, countVersion: 0, countAction: "start-pieces" }).success).toBe(false);
  const current = await room();
  expect((await transitionFriendRoom(current, current.id, { action: "count", token: host, gameId: "old-game", version: 0, countVersion: 0, countAction: "start-board" }, 1000)).status).toBe(409);
});

test("count claims do not change turns, add increment, or refund the active clock", async () => {
  const current = await room();
  current.state.clocks.forEach(clock => { clock.remainingMs = 1000; clock.incrementMs = 100; });
  const result = await transitionFriendRoom(current, current.id, { action: "count", token: host, gameId: current.state.id, countAction: "start-board", countVersion: 0, version: 0 }, 1250);
  expect(result.status).toBe(200);
  expect(result.stored!.state).toMatchObject({ ply: 0, turn: "white" });
  expect(result.stored!.state.clocks.map(clock => clock.remainingMs)).toEqual([750, 1000]);
});
