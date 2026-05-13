import type { Ai, D1Database, R2Bucket } from "@cloudflare/workers-types";

export type CloudflareEnv = {
  DEPLOYMENT_TARGET?: "cloudflare" | "vercel" | "self-hosted" | "local";
  DATABASE_DRIVER?: "d1";
  OBJECT_STORAGE_DRIVER?: "r2";
  ALLCHESS_D1?: D1Database;
  ALLCHESS_OBJECTS?: R2Bucket;
  NEXT_INC_CACHE_R2_BUCKET?: R2Bucket;
  AI?: Ai;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_D1_DATABASE_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  R2_PUBLIC_BASE_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  GOOGLE_REDIRECT_URI?: string;
  SESSION_SECRET?: string;
};

export const cloudflareResourceNames = {
  app: "allchess",
  d1Database: "allchess",
  objectsBucket: "allchess-objects",
  previewObjectsBucket: "allchess-objects-preview",
  cacheBucket: "allchess-opennext-cache"
} as const;

export function normalizeCloudflareEnv(env: Partial<CloudflareEnv> & Record<string, unknown> = {}): CloudflareEnv {
  return {
    ...env,
    DATABASE_DRIVER: "d1",
    OBJECT_STORAGE_DRIVER: "r2",
    DEPLOYMENT_TARGET: (env.DEPLOYMENT_TARGET as CloudflareEnv["DEPLOYMENT_TARGET"]) ?? "local"
  };
}

export function isCloudflareRuntime(env: Partial<CloudflareEnv> | undefined) {
  return env?.DEPLOYMENT_TARGET === "cloudflare" || Boolean(env?.ALLCHESS_D1 || env?.ALLCHESS_OBJECTS);
}
