import { z } from "zod";
import { getGameCatalogEntry, getCatalogModeSupport } from "@/lib/catalog";
import { createInitialState, getVariant } from "@/lib/variants";
import { getTimeControl } from "@/lib/game/time-controls";
import { matchArrivalWindowMs, type FriendRoom } from "./friend-room";

export const quickMatchSchema = z.object({
  token: z.string().regex(/^[a-f0-9-]{36,80}$/),
  variantKey: z.string().min(1).max(64),
  timeControlKey: z.enum(["bullet", "blitz", "rapid", "classical", "correspondence", "freestyle"]),
  rated: z.literal(false).optional()
});
export type QuickMatchInput = z.infer<typeof quickMatchSchema>;
export type MatchedRoomPlan = { id: string; variantKey: string; time: QuickMatchInput["timeControlKey"]; digests: [string, string]; createdAt: number };
type Entry = { digest: string; ticketId: string; expiresAt: number; cancelled?: boolean; match?: MatchedRoomPlan };
export type QuickQueue = { entries: Entry[] };
export type QuickMatchReply = { ticket?: { ticketId: string }; match?: { roomId: string }; left?: boolean; error?: string };
export type QuickTransition = { queue: QuickQueue; body: QuickMatchReply; status: number; provision?: MatchedRoomPlan };
export const quickMatchPartition = (input: QuickMatchInput) => `casual-v1:${input.variantKey}:${input.timeControlKey}`;
export async function hashSeatToken(token: string) {
  const value = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, "0")).join("");
}
export function quickMatchAvailable(input: QuickMatchInput) {
  const game = getGameCatalogEntry(input.variantKey);
  return Boolean(game && getCatalogModeSupport(game, "online").enabled && getCatalogModeSupport(game, "room").enabled);
}

/** One transaction per game/clock queue. No network or async work inside this transition. */
export function transitionQuickMatch(stored: QuickQueue | undefined, input: QuickMatchInput, digest: string, action: "join" | "leave", now = Date.now()): QuickTransition {
  const queue: QuickQueue = { entries: structuredClone(stored?.entries ?? []).filter(entry => entry.expiresAt > now) };
  const respond = (body: QuickMatchReply, status = 200, provision?: MatchedRoomPlan): QuickTransition => ({ queue, body, status, provision });
  let entry = queue.entries.find(item => item.digest === digest);
  // A cancellation racing with pairing must return the committed match, never erase it.
  if (entry?.match) return respond({ match: { roomId: entry.match.id } }, 200, entry.match);
  if (action === "leave") {
    if (!entry && queue.entries.length >= 500) return respond({ error: "This queue is busy. Try again shortly." }, 503);
    if (!entry) { entry = { digest, ticketId: crypto.randomUUID(), expiresAt: now + 60000 }; queue.entries.push(entry); }
    entry.cancelled = true; entry.expiresAt = now + 60000;
    return respond({ left: true });
  }
  if (entry?.cancelled) return respond({ error: "This search was cancelled. Start a new search." }, 410);
  if (!quickMatchAvailable(input)) return respond({ error: "This game is not ready for Quick Match." }, 400);
  if (!entry) {
    if (queue.entries.length >= 500) return respond({ error: "This queue is busy. Try again shortly." }, 503);
    entry = { digest, ticketId: crypto.randomUUID(), expiresAt: now + 30000 }; queue.entries.push(entry);
  }
  entry.expiresAt = now + 30000;
  const opponent = queue.entries.find(item => item.digest !== digest && !item.cancelled && !item.match);
  if (!opponent) return respond({ ticket: { ticketId: entry.ticketId } });
  const digests: [string, string] = crypto.getRandomValues(new Uint8Array(1))[0] % 2 ? [digest, opponent.digest] : [opponent.digest, digest];
  const plan: MatchedRoomPlan = { id: crypto.randomUUID(), variantKey: input.variantKey, time: input.timeControlKey, digests, createdAt: now };
  entry.match = opponent.match = plan;
  entry.expiresAt = opponent.expiresAt = now + 10 * 60000;
  return respond({ match: { roomId: plan.id } }, 200, plan);
}

/** Seats are reserved before a public room URL exists. Retries must retain the existing room. */
export function createMatchedRoom(plan: MatchedRoomPlan): FriendRoom {
  const state = createInitialState(plan.variantKey, plan.id), control = getTimeControl(plan.time);
  state.status = "waiting";
  state.clocks = state.clocks.map(clock => ({ ...clock, remainingMs: control.baseSeconds * 1000, incrementMs: control.incrementSeconds * 1000 }));
  return { id: plan.id, state, ...(state.variantKey === "janggi" ? { janggiSetup: {} } : {}), seats: getVariant(plan.variantKey).players.map((color, index) => ({ color, digest: plan.digests[index] })), time: plan.time, createdAt: plan.createdAt, updatedAt: plan.createdAt, matched: true, arrival: { deadline: plan.createdAt + matchArrivalWindowMs, status: "waiting" } };
}
