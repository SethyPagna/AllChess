import { applyMakrukCountAction, makrukCountVersion, usesMakrukHonorCount } from "@/lib/variants/makruk-counting";
import { z } from "zod";
import { applyMove, createInitialState, getVariant, type GameState, type PlayerColor } from "@/lib/variants";
import { getTimeControl } from "@/lib/game/time-controls";
import { tickGameClock } from "@/lib/game/clocks";
import { getGameCatalogEntry, getCatalogModeSupport } from "@/lib/catalog";

// Piece drops and passes use an off-board source sentinel; the engine validates destinations.
const square = z.object({ row: z.number().int().min(-1).max(19), col: z.number().int().min(-1).max(19) });
const gameId = z.string().min(1).max(100);
const token = z.string().regex(/^[a-f0-9-]{36,80}$/);
export const friendActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), token, variantKey: z.string().max(64), time: z.enum(["bullet", "blitz", "rapid", "classical", "correspondence", "freestyle"]), side: z.enum(["first", "second", "random"]) }),
  z.object({ action: z.literal("join"), token }),
  z.object({ action: z.literal("read"), token: token.optional() }),
  z.object({ action: z.literal("move"), token, gameId, version: z.number().int().min(0), countVersion: z.number().int().min(0).optional(), move: z.object({ from: square, to: square, kind: z.enum(["move", "drop", "pass", "remove"]).optional(), promotion: z.boolean().optional(), drop: z.object({ id: z.string().max(100), code: z.string().max(8), labelKey: z.string().max(64), owner: z.enum(["white", "black", "red", "blue", "sente", "gote"]), promoted: z.boolean().optional() }).optional() }) }),
  z.object({ action: z.literal("count"), token, gameId, version: z.number().int().min(0), countVersion: z.number().int().min(0), countAction: z.enum(["start-board", "stop", "claim-draw"]) }),
  z.object({ action: z.literal("resign"), token, gameId }),
  z.object({ action: z.literal("chat"), token, text: z.string().trim().min(1).max(280) }),
  z.object({ action: z.literal("draw"), token, gameId }),
  z.object({ action: z.literal("rematch"), token, gameId }),
  z.object({ action: z.literal("cancel-rematch"), token, gameId })
]);
export type FriendAction = z.infer<typeof friendActionSchema>;
export type FriendMessage = { id: string; color: PlayerColor; sender?: number; text: string; at: number };
export type FriendRoom = { id: string; revision?: number; state: GameState; seats: Array<{ digest: string; color: PlayerColor; lastSeenAt?: number }>; updatedAt: number; createdAt: number; time: string; rematchOffer?: PlayerColor; drawOffer?: PlayerColor; messages?: FriendMessage[] };
export type FriendRoomView = { roomId: string; revision: number; state: GameState; seat: PlayerColor | null; member: number | null; friendConnected: boolean; playerCount: number; time: string; rematchOffer?: PlayerColor; drawOffer?: PlayerColor; messages?: FriendMessage[] };
export type FriendResult = { status: number; body: { room?: FriendRoomView; error?: string }; stored: FriendRoom | null };

async function digestToken(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

/** Called inside one serialized room operation. Never returns stored seat credentials. */
export async function transitionFriendRoom(stored: FriendRoom | null, id: string, action: FriendAction, now = Date.now()): Promise<FriendResult> {
  let room = stored ? structuredClone(stored) : null;
  const digest = action.token ? await digestToken(action.token) : "";
  const fail = (status: number, error: string): FriendResult => ({ status, body: { error }, stored: room });
  if (action.action === "create") {
    if (room) return fail(409, "This room already exists.");
    const entry = getGameCatalogEntry(action.variantKey);
    if (!entry || !getCatalogModeSupport(entry, "room").enabled) return fail(400, "This game is not ready for friend rooms yet.");
    let state: GameState;
    try { state = createInitialState(action.variantKey); } catch { return fail(400, "Unknown game."); }
    const players = getVariant(action.variantKey).players;
    const index = action.side === "random" ? crypto.getRandomValues(new Uint8Array(1))[0] % 2 : action.side === "second" ? 1 : 0;
    const control = getTimeControl(action.time);
    state.status = "waiting";
    state.clocks = state.clocks.map(clock => ({ ...clock, remainingMs: control.baseSeconds * 1000, incrementMs: control.incrementSeconds * 1000 }));
    room = { id, state, seats: [{ digest, color: players[index] }], updatedAt: now, createdAt: now, time: action.time };
  }
  if (!room) return fail(404, "Room not found. Check the invite link.");
  if (now - room.createdAt > 7 * 86400000) return { status: 410, body: { error: "This invite has expired." }, stored: null };
  room.state = tickGameClock(room.state, Math.max(0, now - room.updatedAt)); room.updatedAt = now;
  room.revision = (room.revision ?? 0) + 1;
  let seat = room.seats.find(item => item.digest === digest)?.color ?? null;
  if (action.action === "join" && !seat) {
    if (room.seats.length >= 2) return fail(409, "Both seats are taken. Open the spectator link to watch.");
    if (room.state.status === "completed") return fail(409, "This game has ended.");
    seat = getVariant(room.state.variantKey).players.find(color => !room!.seats.some(item => item.color === color))!;
    room.seats.push({ digest, color: seat }); room.state.status = "active";
  }
  const member = room.seats.findIndex(item => item.digest === digest);
  if (member >= 0) room.seats[member].lastSeenAt = now;
  if ("gameId" in action) {
    if (!seat) return fail(403, "Only a seated player can act.");
    if (action.gameId !== room.state.id) return fail(409, "A new game has started. Your board will refresh.");
  }
  if (["move", "resign", "draw", "count"].includes(action.action)) {
    if (!seat) return fail(403, "Only a seated player can act.");
    if (room.state.status !== "active") return fail(409, "The game is not active.");
  }
  if (action.action === "count") {
    if (action.version !== room.state.ply || action.countVersion !== makrukCountVersion(room.state)) return fail(409, "The count changed. Your position has been refreshed.");
    try { room.state = applyMakrukCountAction(room.state, seat!, action.countAction); } catch { return fail(400, "That honor-count action is not available."); }
    if (room.state.status === "completed") delete room.drawOffer;
  }
  if (action.action === "move") {
    if (usesMakrukHonorCount(room.state) && action.countVersion !== undefined && action.countVersion !== makrukCountVersion(room.state)) return fail(409, "The count changed. Review the latest position.");
    if (action.version !== room.state.ply) return fail(409, "The board changed. Your position has been refreshed.");
    if (seat !== room.state.turn || (action.move.drop && action.move.drop.owner !== seat)) return fail(403, "Wait for your turn.");
    try { room.state = applyMove(room.state, action.move); } catch { return fail(400, "That move is not legal."); }
    if (room.drawOffer && room.drawOffer !== seat) delete room.drawOffer;
  }
  if (action.action === "chat") {
    if (!seat) return fail(403, "Only players can send room messages.");
    if ((room.messages ?? []).some(message => (message.sender === member || (message.sender === undefined && message.color === seat)) && now - message.at < 1000)) return fail(429, "Please wait a moment before sending again.");
    room.messages = [...(room.messages ?? []), { id: crypto.randomUUID(), color: seat, sender: member, text: action.text, at: now }].slice(-100);
  }
  if (action.action === "resign") { room.state.status = "completed"; room.state.result = getVariant(room.state.variantKey).players.find(color => color !== seat); room.state.outcomeReason = "resignation"; }
  if (action.action === "draw") {
    if (room.drawOffer && room.drawOffer !== seat) { room.state.status = "completed"; room.state.result = "draw"; room.state.outcomeReason = "draw"; delete room.drawOffer; }
    else room.drawOffer = seat!;
  }
  if (action.action === "rematch" || action.action === "cancel-rematch") {
    if (room.state.status !== "completed" || room.seats.length !== 2) return fail(409, "Finish this game before starting a rematch.");
    if (action.action === "cancel-rematch") {
      if (room.rematchOffer !== seat) return fail(403, "Only the player who offered can cancel.");
      delete room.rematchOffer;
    } else if (room.rematchOffer && room.rematchOffer !== seat) {
      // Preserve each participant's identity in the room chat while the sides swap.
      room.messages = room.messages?.map(message => ({ ...message, sender: message.sender ?? room!.seats.findIndex(item => item.color === message.color) }));
      const players = getVariant(room.state.variantKey).players;
      for (const participant of room.seats) participant.color = players.find(color => color !== participant.color)!;
      seat = room.seats[member].color;
      const control = getTimeControl(room.time);
      room.state = createInitialState(room.state.variantKey);
      room.state.clocks = room.state.clocks.map(clock => ({ ...clock, remainingMs: control.baseSeconds * 1000, incrementMs: control.incrementSeconds * 1000 }));
      delete room.drawOffer;
      delete room.rematchOffer;
    } else room.rematchOffer = seat!;
  }
  return { status: 200, stored: room, body: { room: { roomId: id, revision: room.revision, state: room.state, seat, member: member >= 0 ? member : null, friendConnected: room.seats.some(item => item.digest !== digest && item.lastSeenAt !== undefined && now - item.lastSeenAt < 15000), playerCount: room.seats.length, time: room.time, rematchOffer: room.rematchOffer, drawOffer: room.drawOffer, messages: seat ? room.messages ?? [] : [] } } };
}
