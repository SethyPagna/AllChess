import type { CloudflareEnv } from "@/lib/cloudflare/env";

import { createPublicObjectUrl, type ObjectStorage, type ObjectStorageObject, type ObjectStoragePut } from "./object-storage";

export function createR2Storage(env: Pick<CloudflareEnv, "ALLCHESS_OBJECTS">, publicBaseUrl?: string): ObjectStorage {
  if (!env.ALLCHESS_OBJECTS) {
    throw new Error("Cloudflare R2 binding ALLCHESS_OBJECTS is not configured.");
  }

  return {
    async put(input: ObjectStoragePut): Promise<ObjectStorageObject> {
      await env.ALLCHESS_OBJECTS!.put(input.key, input.body, {
        httpMetadata: input.contentType ? { contentType: input.contentType } : undefined
      });
      return {
        key: input.key,
        url: createPublicObjectUrl(publicBaseUrl, input.key),
        contentType: input.contentType
      };
    },
    getUrl(key: string) {
      return createPublicObjectUrl(publicBaseUrl, key);
    }
  };
}
