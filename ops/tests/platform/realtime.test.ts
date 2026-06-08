import { describe, expect, test } from "vitest";

import { POST as botMovePost } from "@/app/api/bots/move/route";
import { GET as liveStatsGet } from "@/app/api/live-stats/route";
import { POST as queueJoinPost } from "@/app/api/matchmaking/join/route";
import { GET as roomGet } from "@/app/api/rooms/[id]/route";
import { POST as roomPost } from "@/app/api/rooms/route";
import { applyAuthoritativeRoomMove, areMatchmakingTicketsCompatible, createMatchmakingMatch, createMatchmakingTicket, createRoomSnapshot } from "@/lib/realtime/rooms";
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

  test("authoritative room moves preserve promotion and hand-drop intent", () => {
    let promotionState = createInitialState("mini-shogi", "room-promotion");
    promotionState = {
      ...promotionState,
      board: promotionState.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      turn: "sente"
    };
    promotionState.board[1][1].piece = { id: "sente-silver", code: "s", owner: "sente", labelKey: "shogi.silver" };
    promotionState.board[4][4].piece = { id: "sente-king", code: "k", owner: "sente", labelKey: "shogi.king" };
    promotionState.board[0][4].piece = { id: "gote-king", code: "k", owner: "gote", labelKey: "shogi.king" };

    const promoted = applyAuthoritativeRoomMove(createRoomSnapshot({ state: promotionState }), { from: { row: 1, col: 1 }, to: { row: 0, col: 0 }, promotion: true });
    expect(promoted).toMatchObject({ ok: true });
    if (promoted.ok) expect(promoted.snapshot.state.board[0][0].piece?.promoted).toBe(true);

    let dropState = createInitialState("mini-shogi", "room-drop");
    dropState = {
      ...dropState,
      board: dropState.board.map((row) => row.map((cell) => ({ ...cell, piece: null }))),
      hands: { sente: { p: 1 } },
      turn: "sente"
    };
    dropState.board[4][4].piece = { id: "sente-king", code: "k", owner: "sente", labelKey: "shogi.king" };
    dropState.board[0][4].piece = { id: "gote-king", code: "k", owner: "gote", labelKey: "shogi.king" };
    const dropSnapshot = createRoomSnapshot({ state: dropState });

    expect(
      applyAuthoritativeRoomMove(dropSnapshot, {
        kind: "drop",
        from: { row: 0, col: 0 },
        to: { row: 2, col: 2 },
        drop: { id: "gote-pawn", code: "p", owner: "gote", labelKey: "shogi.pawn" }
      })
    ).toMatchObject({ ok: false });

    const legalDrop = applyAuthoritativeRoomMove(dropSnapshot, {
      kind: "drop",
      from: { row: 0, col: 0 },
      to: { row: 2, col: 2 },
      drop: { id: "sente-pawn", code: "p", owner: "sente", labelKey: "shogi.pawn" }
    });
    expect(legalDrop).toMatchObject({ ok: true });
    if (legalDrop.ok) expect(legalDrop.snapshot.state.board[2][2].piece).toMatchObject({ code: "p", owner: "sente" });
  });

  test("authoritative room move validation supports regional pass moves", () => {
    const snapshot = createRoomSnapshot({ state: createInitialState("janggi", "room-pass") });
    const passed = applyAuthoritativeRoomMove(snapshot, { kind: "pass", from: { row: -1, col: -1 }, to: { row: -1, col: -1 } });

    expect(passed).toMatchObject({ ok: true });
    if (passed.ok) expect(passed.snapshot.moveVersion).toBe(1);
  });

  test("matchmaking tickets use rating windows and requested settings", () => {
    const ticket = createMatchmakingTicket({ profileId: "p1", variantKey: "shogi", timeControlKey: "blitz", rating: 1750, rated: true });

    expect(ticket).toMatchObject({
      profileId: "p1",
      variantKey: "shogi",
      timeControlKey: "blitz",
      ratingRange: [1550, 1950],
      rated: true
    });
    expect(areMatchmakingTicketsCompatible(ticket, createMatchmakingTicket({ profileId: "p2", variantKey: "shogi", timeControlKey: "blitz", rating: 1850, rated: true }))).toBe(true);
    expect(areMatchmakingTicketsCompatible(ticket, createMatchmakingTicket({ profileId: "p2", variantKey: "shogi", timeControlKey: "rapid", rating: 1850, rated: true }))).toBe(false);
    expect(areMatchmakingTicketsCompatible(ticket, createMatchmakingTicket({ profileId: "p1", variantKey: "shogi", timeControlKey: "blitz", rating: 1850, rated: true }))).toBe(false);
    expect(createMatchmakingMatch(ticket, { ...ticket, ticketId: "opponent-ticket", profileId: "p2" })).toMatchObject({
      type: "match_found",
      ticketId: ticket.ticketId,
      opponentTicketId: "opponent-ticket"
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
    await expect(stats.json()).resolves.toMatchObject({ source: "demo", playersOnline: 0, catalog: { playableGames: 20 } });

    const bot = await botMovePost(
      new Request("http://allchess.test/api/bots/move", {
        method: "POST",
        body: JSON.stringify({ state: createInitialState("classic", "bot-api"), tier: "grandmaster", engineMode: "internal", maxSearchTimeMs: 40 })
      })
    );
    await expect(bot.json()).resolves.toMatchObject({ status: "ok", tier: "grandmaster", legal: true });
  });
});
