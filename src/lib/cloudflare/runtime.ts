import type { CloudflareEnv } from "./env";
import { createD1RestDatabase } from "./d1-rest";
import { normalizeCloudflareEnv } from "./env";

type OpenNextCloudflareModule = {
  getCloudflareContext?: () => { env?: Partial<CloudflareEnv> };
};

export async function getCloudflareRuntimeEnv(): Promise<CloudflareEnv> {
  try {
    const cloudflareModule = (await import("@opennextjs/cloudflare")) as OpenNextCloudflareModule;
    const contextEnv = cloudflareModule.getCloudflareContext?.().env;
    if (contextEnv) return attachRestAdapters(normalizeCloudflareEnv(contextEnv));
  } catch {
    // Local Next.js and Vercel do not expose OpenNext's Cloudflare context.
  }

  return attachRestAdapters(normalizeCloudflareEnv(process.env));
}

function attachRestAdapters(env: CloudflareEnv) {
  if (!env.ALLCHESS_D1) {
    env.ALLCHESS_D1 = createD1RestDatabase(env) ?? undefined;
  }
  return env;
}
