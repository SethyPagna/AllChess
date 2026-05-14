import { describe, expect, test } from "vitest";

import { POST as botMovePost } from "@/app/api/bots/move/route";
import { GET as liveStatsGet } from "@/app/api/live-stats/route";
import { POST as queueJoinPost } from "@/app/api/matchmaking/join/route";
import { GET as roomGet } from "@/app/api/rooms/[id]/route";
import { POST as roomPost } from "@/app/api/rooms/route";
import { applyAuthoritativeRoomMove, createMatchmakingTicket, createRoomSnapshot } from "@/lib/realtime/rooms";
import { createInitialState } from "@/lib/variants";

describe("realtime multiplayer foundations", () => {
  test("creates room snapshots with authoritative move versions", () => {
    const snapshot = createRoomSnapshot({ variantKey: "classic", rated: true });

    expect(snapshot).toMatchObject({
      variantKey: "classic",
      status: "active",
      moveVersion: 0,
      rated: true,
      spectators: 0
    });
    expect(snapshot.players).toHaveLength(2);
  });

  test("authoritative room move validation rejects illegal moves and applies legal moves", () => {
    const snapshot = createRoomSnapshot({ variantKey: "classic" });

    expect(applyAuthoritativeRoomMove(snapshot, { from: { row: 6, col: 0 }, to: { row: 3, col: 0 } })).toMatchObject({ ok: false });

    const legal = applyAuthoritativeRoomMove(snapshot, { from: { row: 6, col: 0 }, to: { row: 4, col: 0 } });
    expect(legal).toMatchObject({ ok: true });
    if (legal.ok) expect(legal.snapshot.moveVersion).toBe(1);
  });

  test("matchmaking tickets use rating windows and requested settings", () => {
    expect(createMatchmakingTicket({ profileId: "p1", variantKey: "shogi", timeControlKey: "blitz", rating: 1750, rated: true })).toMatchObject({
      profileId: "p1",
      variantKey: "shogi",
      timeControlKey: "blitz",
      ratingRange: [1550, 1950],
      rated: true
    });
  });

  test("room, queue, stats, and bot move APIs return typed demo payloads", async () => {
    const createdRoom = await roomPost(new Request("http://allchess.test/api/rooms", { method: "POST", body: JSON.stringify({ variantKey: "classic", rated: true }) }));
    await expect(createdRoom.json()).resolves.toMatchObject({ mode: "demo", snapshot: { variantKey: "classic", rated: true } });

    const fetchedRoom = await roomGet(new Request("http://allchess.test/api/rooms/room-1"), { params: Promise.resolve({ id: "room-1" }) });
    await expect(fetchedRoom.json()).resolves.toMatchObject({ snapshot: { roomId: "room-1" } });

    const ticket = await queueJoinPost(new Request("http://allchess.test/api/matchmaking/join", { method: "POST", body: JSON.stringify({ profileId: "p1" }) }));
    await expect(ticket.json()).resolves.toMatchObject({ mode: "demo", ticket: { profileId: "p1" } });

    const stats = await liveStatsGet();
    await expect(stats.json()).resolves.toMatchObject({ source: "demo", playersOnline: 0, catalog: { playableGames: 5 } });

    const bot = await botMovePost(
      new Request("http://allchess.test/api/bots/move", {
        method: "POST",
        body: JSON.stringify({ state: createInitialState("classic", "bot-api"), tier: "grandmaster", engineMode: "internal", maxSearchTimeMs: 40 })
      })
    );
    await expect(bot.json()).resolves.toMatchObject({ status: "ok", tier: "grandmaster", legal: true });
  });
});
