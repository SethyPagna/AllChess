/**
 * The legacy /api/rooms and /api/games writes carry no seat or turn identity, so any caller
 * could move either side. Online play uses friend rooms; these writes stay open for local work and tests only.
 */
export function legacyWritesEnabled() {
  return process.env.NODE_ENV === "development" || process.env.NODE_ENV === "test";
}

export const legacyWriteRetiredReason = "This endpoint is retired. Use a friend room to play online.";

export function legacyWriteRetired() {
  return Response.json({ error: legacyWriteRetiredReason }, { status: 410 });
}
