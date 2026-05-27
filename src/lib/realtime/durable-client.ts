import type { DurableObjectNamespace } from "@cloudflare/workers-types";

type DurableJsonResult<T> = {
  ok: boolean;
  status: number;
  data: T;
};

export async function fetchDurableJson<T>(namespace: DurableObjectNamespace | undefined, name: string, pathname: string, init?: RequestInit): Promise<DurableJsonResult<T> | null> {
  if (!namespace) return null;

  const id = namespace.idFromName(name);
  const stub = namespace.get(id);
  const headers = new Headers(init?.headers as HeadersInit | undefined);
  headers.set("content-type", headers.get("content-type") ?? "application/json");
  const response = await stub.fetch(`https://allchess.internal${pathname}`, {
    method: init?.method,
    headers: Object.fromEntries(headers),
    body: typeof init?.body === "string" || init?.body == null ? init?.body : String(init.body)
  });
  const data = (await response.json().catch(() => ({}))) as T;
  return { ok: response.ok, status: response.status, data };
}
