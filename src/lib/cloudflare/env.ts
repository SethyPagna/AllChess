export type CloudflareEnv = {
  DEPLOYMENT_TARGET?: "cloudflare" | "vercel" | "self-hosted" | "local";
  DATABASE_DRIVER?: "supabase" | "postgres" | "d1" | "hyperdrive";
  OBJECT_STORAGE_DRIVER?: "r2" | "s3" | "local";
  ALLCHESS_D1?: D1Database;
  ALLCHESS_OBJECTS?: R2Bucket;
  NEXT_INC_CACHE_R2_BUCKET?: R2Bucket;
  HYPERDRIVE?: Hyperdrive;
  AI?: Ai;
};

export function isCloudflareRuntime(env: Partial<CloudflareEnv> | undefined) {
  return env?.DEPLOYMENT_TARGET === "cloudflare" || Boolean(env?.ALLCHESS_D1 || env?.ALLCHESS_OBJECTS);
}
