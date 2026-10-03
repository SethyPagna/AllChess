import { describe, expect, test } from "vitest";
import { createMatchedRoom, hashSeatToken } from "@/lib/realtime/quick-match";
import { matchArrivalWindowMs, nextFriendRoomAlarm, settleMatchArrival, transitionFriendRoom, type FriendRoom } from "@/lib/realtime/friend-room";
import { describeGameOutcome } from "@/lib/game/outcome";

const a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222", stranger = "33333333-3333-4333-8333-333333333333";
async function reserved() {
  return createMatchedRoom({ id: "reserved", variantKey: "makruk", time: "rapid", digests: [await hashSeatToken(a), await hashSeatToken(b)], createdAt: 1000 });
}
async function joined(room: FriendRoom, token: string, now: number) {
  return (await transitionFriendRoom(room, room.id, { action: "join", token }, now)).stored!;
}

describe("Quick Match arrival lifecycle", () => {
  test("publishes a server-derived countdown and keeps all game clocks unchanged", async () => {
    const room = await joined(await reserved(), a, 2000);
    const read = await transitionFriendRoom(room, room.id, { action: "read", token: a }, 6000);
    expect(read.body.room?.arrival).toEqual({ deadline: 1000 + matchArrivalWindowMs, status: "waiting", remainingMs: 55000 });
    expect(read.stored?.state.clocks).toEqual(room.state.clocks);
    expect(nextFriendRoomAlarm(read.stored!)).toBe(61000);
  });
  test.each([61000, 70000])("deadline %i closes admission before a late join without creating a game result", async now => {
    let room = await joined(await reserved(), a, 2000);
    room = await joined(room, b, now);
    expect(room.arrival?.status).toBe("expired"); expect(room.state.status).toBe("waiting");
    expect(room.state.result).toBeUndefined(); expect(room.state.outcomeReason).toBeUndefined(); expect(room.state.ply).toBe(0);
    expect(describeGameOutcome(room.state)).toBeNull(); expect(room.state.clocks[0].remainingMs).toBe(600000);
    const read = await transitionFriendRoom(room, room.id, { action: "read", token: b }, now + 1);
    expect(read.status).toBe(200); expect(read.body.room?.arrival?.remainingMs).toBe(0);
  });
  test("a last-moment join starts exactly once and replaces the arrival alarm with room expiry", async () => {
    let room = await joined(await reserved(), a, 2000);
    room = await joined(room, b, 60999);
    expect(room.state.status).toBe("active"); expect(room.arrival).toBeUndefined();
    expect(nextFriendRoomAlarm(room)).toBe(1000 + 7 * 86400000);
    expect(settleMatchArrival(room, 70000)).toBe(false);
    const result = await transitionFriendRoom(room, room.id, { action: "leave-before-start", token: a, gameId: room.state.id }, 61999);
    expect(result.status).toBe(409); expect(result.stored?.state.status).toBe("active");
    expect(result.stored?.state.clocks[0].remainingMs).toBe(599000);
  });
  test("a cancellation that wins the race stays closed through duplicate requests and late joins", async () => {
    let room = await joined(await reserved(), a, 2000);
    const action = { action: "leave-before-start" as const, token: a, gameId: room.state.id };
    room = (await transitionFriendRoom(room, room.id, action, 3000)).stored!;
    expect(room.arrival?.status).toBe("cancelled");
    room = await joined(room, b, 3000);
    room = (await transitionFriendRoom(room, room.id, action, 5000)).stored!;
    expect(room.arrival?.status).toBe("cancelled"); expect(room.state.status).toBe("waiting");
    expect(describeGameOutcome(room.state)).toBeNull();
    expect(settleMatchArrival(room, 70000)).toBe(false);
  });
  test("spectators, stale games and ordinary friend invites cannot use arrival cancellation", async () => {
    const room = await reserved();
    expect((await transitionFriendRoom(room, room.id, { action: "leave-before-start", token: stranger, gameId: room.state.id }, 2000)).status).toBe(403);
    expect((await transitionFriendRoom(room, room.id, { action: "leave-before-start", token: a, gameId: "old-game" }, 2000)).status).toBe(409);
    delete room.matched; delete room.arrival;
    expect((await transitionFriendRoom(room, room.id, { action: "leave-before-start", token: a, gameId: room.state.id }, 2000)).status).toBe(409);
    expect(settleMatchArrival(room, 70000)).toBe(false);
  });
  test("alarm settlement and legacy waiting rooms use the original deadline without extending it", async () => {
    const room = await reserved(); delete room.arrival;
    expect(settleMatchArrival(room, 60000)).toBe(true);
    expect(room.arrival).toEqual({ deadline: 61000, status: "waiting" });
    const restored = structuredClone(room);
    expect(settleMatchArrival(restored, 61000)).toBe(true);
    expect(settleMatchArrival(restored, 62000)).toBe(false);
    expect(restored.arrival?.status).toBe("expired"); expect(nextFriendRoomAlarm(restored)).toBe(1000 + 7 * 86400000);
  });
  test("a closed room cannot accept moves, claims or rematches", async () => {
    const room = await joined(await reserved(), a, 62000);
    for (const action of [
      { action: "move" as const, version: 0, move: { from: { row: 5, col: 0 }, to: { row: 4, col: 0 } } },
      { action: "count" as const, version: 0, countVersion: 0, countAction: "start-board" as const },
      { action: "rematch" as const }, { action: "draw" as const }, { action: "resign" as const }
    ]) {
      const result = await transitionFriendRoom(room, room.id, { ...action, token: a, gameId: room.state.id }, 63000);
      expect(result.status).toBe(409); expect(result.stored?.state.ply).toBe(0); expect(result.stored?.state.result).toBeUndefined();
    }
  });
});
