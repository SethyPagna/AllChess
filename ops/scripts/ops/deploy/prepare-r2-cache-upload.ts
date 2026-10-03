import { writeFileSync } from "node:fs";
import { getCacheAssets } from "../../../../node_modules/@opennextjs/cloudflare/dist/cli/commands/populate-cache.js";
import { getNormalizedOptions, retrieveCompiledConfig } from "../../../../node_modules/@opennextjs/cloudflare/dist/cli/commands/utils/utils.js";
import { computeCacheKey, DEFAULT_PREFIX } from "../../../../node_modules/@opennextjs/cloudflare/dist/api/overrides/internal.js";

const { config } = await retrieveCompiledConfig();
const entries = getCacheAssets(getNormalizedOptions(config)).map((asset) => ({
  key: computeCacheKey(asset.key, {
    prefix: DEFAULT_PREFIX,
    buildId: asset.buildId,
    cacheType: asset.isFetch ? "fetch" : "cache"
  }),
  file: asset.fullPath
}));
if (entries.length === 0) throw new Error("The release has no generated page cache to upload.");
writeFileSync(".open-next/cache-upload.json", JSON.stringify(entries));
console.log(`Prepared ${entries.length} release cache entries for direct R2 upload.`);
