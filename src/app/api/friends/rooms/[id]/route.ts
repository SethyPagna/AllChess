import { friendActionSchema } from "@/lib/realtime/friend-room";
import { runFriendAction } from "@/lib/realtime/friend-room-runtime";
import { hasValidFriendOrigin } from "@/lib/realtime/friend-request";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[a-f0-9-]{36}$/.test(id)) return Response.json({ error: "Invalid room code." }, { status: 400 });
  if (!hasValidFriendOrigin(request)) return Response.json({ error: "Invalid origin." }, { status: 403 });
  const data = friendActionSchema.safeParse(await request.json().catch(() => null));
  if (!data.success || data.data.action === "create") return Response.json({ error: "Invalid room action." }, { status: 400 });
  return runFriendAction(id, data.data);
}
