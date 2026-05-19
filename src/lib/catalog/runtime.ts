import { getD1CatalogEntry, listD1CatalogEntries } from "@/lib/cloudflare/d1-catalog";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";

import { getGameCatalog, getGameCatalogEntry } from "./index";

export async function getRuntimeCatalogEntries() {
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) return getGameCatalog();

  try {
    const entries = await listD1CatalogEntries(env.ALLCHESS_D1);
    return entries.length > 0 ? entries : getGameCatalog();
  } catch {
    return getGameCatalog();
  }
}

export async function getRuntimeCatalogEntry(idOrAlias: string) {
  const env = await getCloudflareRuntimeEnv();
  if (!env.ALLCHESS_D1) return getGameCatalogEntry(idOrAlias);

  try {
    return (await getD1CatalogEntry(env.ALLCHESS_D1, idOrAlias)) ?? getGameCatalogEntry(idOrAlias);
  } catch {
    return getGameCatalogEntry(idOrAlias);
  }
}
