import { friendActionSchema } from "@/lib/realtime/friend-room";
import { runFriendAction } from "@/lib/realtime/friend-room-runtime";
import { hasValidFriendOrigin } from "@/lib/realtime/friend-request";

export async function POST(request: Request) {
  if (!hasValidFriendOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const data = friendActionSchema.safeParse(await request.json().catch(() => null));
  if (!data.success || data.data.action !== "create") return Response.json({ error: "Invalid room setup." }, { status: 400 });
  return runFriendAction(crypto.randomUUID(), data.data);
}
