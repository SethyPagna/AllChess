import { describe, expect, test } from "vitest";
import { friendActionSchema, transitionFriendRoom } from "@/lib/realtime/friend-room";
import { hasValidFriendOrigin } from "@/lib/realtime/friend-request";

const host = "11111111-1111-4111-8111-111111111111";
const guest = "22222222-2222-4222-8222-222222222222";
const other = "33333333-3333-4333-8333-333333333333";
async function create() { return (await transitionFriendRoom(null, "room", { action: "create", token: host, variantKey: "classic", time: "blitz", side: "first" }, 1000)).stored!; }
async function joined() { return (await transitionFriendRoom(await create(), "room", { action: "join", token: guest }, 5000)).stored!; }
const move = { from: { row: 6, col: 4 }, to: { row: 4, col: 4 } };
describe("friend room authority", () => {
  test("rejects malformed and foreign browser origins", () => {
    for (const origin of ["null", "malformed", "https://foreign.example"]) expect(hasValidFriendOrigin(new Request("https://allchess.example/api/friends/rooms", { headers: { origin } }))).toBe(false);
    expect(hasValidFriendOrigin(new Request("http://localhost:3000/api/friends/rooms", { headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" } }))).toBe(true);
  });
  test("preview rules cannot bypass the friend-mode readiness gate", async () => {
    expect((await transitionFriendRoom(null, "preview", { action: "create", token: host, variantKey: "ouk-chaktrang", time: "freestyle", side: "first" })).status).toBe(400);
  });
  test("accepts Shogi drop sentinels but rejects drops absent from the hand", async () => {
    const created = await transitionFriendRoom(null, "shogi-room", { action: "create", token: host, variantKey: "shogi", time: "freestyle", side: "first" }, 1000);
    const joined = await transitionFriendRoom(created.stored, "shogi-room", { action: "join", token: guest }, 2000);
    const room = joined.stored!;
    const action = friendActionSchema.parse({ action: "move", token: host, version: 0, move: { kind: "drop", from: { row: -1, col: -1 }, to: { row: 4, col: 4 }, drop: { id: "hand", code: "g", labelKey: "gold", owner: "sente" } } });
    expect((await transitionFriendRoom(room, "shogi-room", action, 2000)).status).toBe(400);
    room.state.hands = { ...room.state.hands, sente: { g: 1 } };
    const dropped = await transitionFriendRoom(room, "shogi-room", action, 2000);
    expect(dropped.status).toBe(200);
    expect(dropped.stored!.state.board[4][4].piece).toMatchObject({ code: "g", owner: "sente" });
  });
  test("waits without charging the host clock and assigns distinct seats", async () => {
    const room = await create(); expect(room.state.status).toBe("waiting");
    const result = await transitionFriendRoom(room, "room", { action: "join", token: guest }, 100000);
    expect(result.body.room).toMatchObject({ seat: "black", playerCount: 2 });
    expect(result.stored!.state.clocks[0].remainingMs).toBe(300000);
    expect(JSON.stringify(result.body)).not.toContain("digest"); expect(JSON.stringify(result.body)).not.toContain(host);
  });
  test("rejoining keeps a seat and a third player cannot take one", async () => {
    const room = await joined(); expect((await transitionFriendRoom(room, "room", { action: "join", token: guest }, 5000)).body.room?.seat).toBe("black");
    expect((await transitionFriendRoom(room, "room", { action: "join", token: other }, 5000)).status).toBe(409);
    expect((await transitionFriendRoom(room, "room", { action: "read" }, 5000)).body.room?.seat).toBeNull();
  });
  test("snapshots remain ordered even when requests share a clock timestamp", async () => {
    const room = await joined();
    const first = await transitionFriendRoom(room, "room", { action: "read", token: host }, 5000);
    const second = await transitionFriendRoom(first.stored, "room", { action: "draw", token: host }, 5000);
    expect(second.body.room!.revision).toBeGreaterThan(first.body.room!.revision);
  });
  test("rejects spectators, wrong turns, stale versions and illegal moves", async () => {
    const room = await joined();
    for (const [token, version, expected] of [[other, 0, 403], [guest, 0, 403], [host, 2, 409]] as const) expect((await transitionFriendRoom(room, "room", { action: "move", token, version, move }, 5000)).status).toBe(expected);
    expect((await transitionFriendRoom(room, "room", { action: "move", token: host, version: 0, move: { ...move, to: { row: 2, col: 4 } } }, 5000)).status).toBe(400);
  });
  test("charges elapsed server time and accepts a legal move once", async () => {
    const result = await transitionFriendRoom(await joined(), "room", { action: "move", token: host, version: 0, move }, 8000);
    expect(result.status).toBe(200); expect(result.stored!.state.ply).toBe(1); expect(result.stored!.state.clocks[0].remainingMs).toBe(297000);
    expect((await transitionFriendRoom(result.stored, "room", { action: "move", token: host, version: 0, move }, 8001)).status).toBe(409);
  });
  test("draws need the other player’s agreement; resignation uses the actor’s seat", async () => {
    const offer = await transitionFriendRoom(await joined(), "room", { action: "draw", token: host }, 5000);
    expect(offer.stored!.state.status).toBe("active");
    const accept = await transitionFriendRoom(offer.stored, "room", { action: "draw", token: guest }, 5000);
    expect(accept.stored!.state.result).toBe("draw");
    const resign = await transitionFriendRoom(await joined(), "room", { action: "resign", token: guest }, 5000);
    expect(resign.stored!.state.result).toBe("white");
  });
  test("a move after timeout cannot revive the game", async () => {
    const result = await transitionFriendRoom(await joined(), "room", { action: "move", token: host, version: 0, move }, 305001);
    expect(result.status).toBe(409); expect(result.stored!.state).toMatchObject({ status: "completed", result: "black", outcomeReason: "timeout" });
  });
  test("private chat is bounded, rate-limited, and hidden from spectators", async () => {
    const room = await joined();
    expect((await transitionFriendRoom(room, "room", { action: "chat", token: other, text: "intruder" }, 5000)).status).toBe(403);
    const sent = await transitionFriendRoom(room, "room", { action: "chat", token: host, text: "Hello" }, 5000);
    expect(sent.body.room?.messages?.[0].text).toBe("Hello");
    expect((await transitionFriendRoom(sent.stored, "room", { action: "chat", token: host, text: "Again" }, 5001)).status).toBe(429);
    expect((await transitionFriendRoom(sent.stored, "room", { action: "read" }, 5002)).body.room?.messages).toEqual([]);
    expect((await transitionFriendRoom(sent.stored, "room", { action: "read", token: guest }, 5002)).body.room?.messages).toHaveLength(1);
  });
});
