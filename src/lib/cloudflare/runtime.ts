import type { CloudflareEnv } from "./env";
import { normalizeCloudflareEnv } from "./env";

type OpenNextCloudflareModule = {
  getCloudflareContext?: () => { env?: Partial<CloudflareEnv> };
};

export async function getCloudflareRuntimeEnv(): Promise<CloudflareEnv> {
  try {
    const cloudflareModule = (await import("@opennextjs/cloudflare")) as OpenNextCloudflareModule;
    const contextEnv = cloudflareModule.getCloudflareContext?.().env;
    if (contextEnv) return normalizeCloudflareEnv(contextEnv);
  } catch {
    // Local Next.js and Vercel do not expose OpenNext's Cloudflare context.
  }

  return normalizeCloudflareEnv(process.env);
}
