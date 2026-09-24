/** Match the browser-facing host: Next's internal request URL may use localhost. */
export function hasValidFriendOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  try {
    const parsed = new URL(origin);
    return ["http:", "https:"].includes(parsed.protocol) && parsed.host === (request.headers.get("host") ?? new URL(request.url).host);
  } catch { return false; }
}
