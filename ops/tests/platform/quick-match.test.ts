import { describe, expect, test } from "vitest";
import { createMatchedRoom, hashSeatToken, quickMatchPartition, transitionQuickMatch, type QuickMatchInput } from "@/lib/realtime/quick-match";
import { transitionFriendRoom } from "@/lib/realtime/friend-room";

const a = "11111111-1111-4111-8111-111111111111", b = "22222222-2222-4222-8222-222222222222";
const input: QuickMatchInput = { token: a, variantKey: "makruk", timeControlKey: "rapid" };
describe("protected Quick Match pairing", () => {
  test("polls are idempotent and both players recover the same committed match", () => {
    const first = transitionQuickMatch(undefined, input, "a", "join", 1000);
    const poll = transitionQuickMatch(first.queue, input, "a", "join", 2000);
    expect(poll.body.ticket).toEqual(first.body.ticket); expect(poll.queue.entries).toHaveLength(1);
    const paired = transitionQuickMatch(poll.queue, input, "b", "join", 3000);
    expect(paired.provision?.digests.slice().sort()).toEqual(["a", "b"]);
    const recovered = transitionQuickMatch(structuredClone(paired.queue), input, "a", "join", 5000);
    expect(recovered.body.match).toEqual(paired.body.match); expect(recovered.provision).toEqual(paired.provision);
    expect(JSON.stringify(recovered.body)).not.toContain("digests");
  });
  test("a third participant cannot pair with an already matched ticket", () => {
    let queue = transitionQuickMatch(undefined, input, "a", "join", 0).queue;
    queue = transitionQuickMatch(queue, input, "b", "join", 1).queue;
    const third = transitionQuickMatch(queue, input, "c", "join", 2);
    expect(third.body.match).toBeUndefined(); expect(third.body.ticket).toBeDefined();
  });
  test("lease expiration removes abandoned waiters and game/clock partitions differ", () => {
    const first = transitionQuickMatch(undefined, input, "a", "join", 0);
    const next = transitionQuickMatch(first.queue, input, "b", "join", 30001);
    expect(next.body.match).toBeUndefined(); expect(next.queue.entries).toHaveLength(1);
    expect(quickMatchPartition(input)).not.toBe(quickMatchPartition({ ...input, variantKey: "classic" }));
    expect(quickMatchPartition(input)).not.toBe(quickMatchPartition({ ...input, timeControlKey: "blitz" }));
  });
  test("cancel wins against a delayed join, but cannot erase a committed pair", () => {
    const cancelled = transitionQuickMatch(undefined, input, "a", "leave", 0);
    expect(transitionQuickMatch(cancelled.queue, input, "a", "join", 1).status).toBe(410);
    const first = transitionQuickMatch(undefined, input, "a", "join", 0);
    const paired = transitionQuickMatch(first.queue, input, "b", "join", 1);
    expect(transitionQuickMatch(paired.queue, input, "a", "leave", 2).body.match).toEqual(paired.body.match);
    expect(transitionQuickMatch(first.queue, input, "stranger", "leave", 1).queue.entries.find(e => e.digest === "a")?.cancelled).toBeUndefined();
  });
  test("preview games cannot bypass the online readiness gate", () => {
    expect(transitionQuickMatch(undefined, { ...input, variantKey: "ouk-chaktrang" }, "a", "join").status).toBe(400);
  });
  test("reserved seats start clocks only after both assigned players join, with authority retained", async () => {
    const digests: [string, string] = [await hashSeatToken(a), await hashSeatToken(b)];
    let room = createMatchedRoom({ id: "matched", variantKey: "makruk", time: "rapid", digests, createdAt: 1000 });
    const outsider = await transitionFriendRoom(room, room.id, { action: "join", token: crypto.randomUUID() }, 2000);
    expect(outsider.status).toBe(409);
    room = (await transitionFriendRoom(room, room.id, { action: "join", token: a }, 5000)).stored!;
    expect(room.state.status).toBe("waiting");
    room = (await transitionFriendRoom(room, room.id, { action: "read", token: b }, 20000)).stored!;
    expect(room.state.status).toBe("waiting");
    room = (await transitionFriendRoom(room, room.id, { action: "join", token: b }, 30000)).stored!;
    expect(room.state.status).toBe("active"); expect(room.state.clocks[0].remainingMs).toBe(600000);
    expect(room.state.variantState?.makrukProfile).toBe("honor-v1");
    const move = { from: { row: 5, col: 0 }, to: { row: 4, col: 0 } };
    expect((await transitionFriendRoom(room, room.id, { action: "move", token: b, gameId: room.state.id, version: 0, move }, 30000)).status).toBe(403);
    room = (await transitionFriendRoom(room, room.id, { action: "move", token: a, gameId: room.state.id, version: 0, move }, 31000)).stored!;
    expect(room.state.ply).toBe(1); expect(room.state.clocks[0].remainingMs).toBe(599000);
    expect(JSON.stringify((await transitionFriendRoom(room, room.id, { action: "read" }, 31000)).body)).not.toContain(digests[0]);
  });
});
