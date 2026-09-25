import { hasValidFriendOrigin } from "./friend-request";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { fetchDurableJson } from "./durable-client";
import { provisionLocalMatch } from "./friend-room-runtime";
import { hashSeatToken, quickMatchAvailable, quickMatchPartition, quickMatchSchema, transitionQuickMatch, type MatchedRoomPlan, type QuickMatchReply, type QuickQueue } from "./quick-match";

const dev = globalThis as typeof globalThis & { allchessQuickQueues?: Map<string, QuickQueue>; allchessQuickLocks?: Map<string, Promise<unknown>> };
export async function runQuickMatch(request: Request, action: "join" | "leave") {
  if (!hasValidFriendOrigin(request)) return Response.json({ error: "Invalid request origin." }, { status: 403 });
  const parsed = quickMatchSchema.safeParse(await request.json().catch(() => null));
  const reply = (body: QuickMatchReply, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
  if (!parsed.success) return reply({ error: "Invalid search. Please start again." }, 400);
  const input = parsed.data, partition = quickMatchPartition(input);
  if (!quickMatchAvailable(input)) return reply({ error: "This game is not ready for Quick Match." }, 400);
  const env = await getCloudflareRuntimeEnv();
  try {
    if (env.MATCHMAKING_DO && env.GAME_ROOM_DO) {
      const result = await fetchDurableJson<QuickMatchReply & { provision?: MatchedRoomPlan }>(env.MATCHMAKING_DO, partition, `/matchmaking/${action}`, { method: "POST", body: JSON.stringify(input) });
      const { provision, ...body } = result!.data;
      if (provision) {
        const ready = await fetchDurableJson(env.GAME_ROOM_DO, `friend-${provision.id}`, "/matched-room", { method: "POST", body: JSON.stringify(provision) });
        if (!ready?.ok) return reply({ error: "Preparing your game. Reconnecting…" }, 503);
      }
      return reply(body, result!.status);
    }
    if (process.env.NODE_ENV !== "development" && process.env.NODE_ENV !== "test") return reply({ error: "Quick Match is unavailable. Try a local game." }, 503);
    const digest = await hashSeatToken(input.token);
    const queues = dev.allchessQuickQueues ??= new Map(), locks = dev.allchessQuickLocks ??= new Map();
    const previous = locks.get(partition) ?? Promise.resolve();
    const task = previous.catch(() => undefined).then(() => {
      const result = transitionQuickMatch(queues.get(partition), input, digest, action);
      queues.set(partition, result.queue); return result;
    });
    locks.set(partition, task);
    const result = await task.finally(() => { if (locks.get(partition) === task) locks.delete(partition); });
    if (result.provision) await provisionLocalMatch(result.provision);
    return reply(result.body, result.status);
  } catch { return reply({ error: "Connection interrupted. Checking your search again…" }, 503); }
}
