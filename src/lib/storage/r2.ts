import type { CloudflareEnv } from "@/lib/cloudflare/env";

import { createPublicObjectUrl, normalizeObjectKey, type ObjectStorage, type ObjectStorageObject, type ObjectStoragePut } from "./object-storage";

type R2PutBody = Parameters<NonNullable<CloudflareEnv["ALLCHESS_OBJECTS"]>["put"]>[1];

export function createR2Storage(env: Pick<CloudflareEnv, "ALLCHESS_OBJECTS">, publicBaseUrl?: string): ObjectStorage {
  if (!env.ALLCHESS_OBJECTS) {
    throw new Error("Cloudflare R2 binding ALLCHESS_OBJECTS is not configured.");
  }

  return {
    async put(input: ObjectStoragePut): Promise<ObjectStorageObject> {
      const key = normalizeObjectKey(input.key);
      await env.ALLCHESS_OBJECTS!.put(key, input.body as R2PutBody, {
        httpMetadata: input.contentType ? { contentType: input.contentType } : undefined
      });
      return {
        key,
        url: createPublicObjectUrl(publicBaseUrl, key),
        contentType: input.contentType
      };
    },
    getUrl(key: string) {
      return createPublicObjectUrl(publicBaseUrl, key);
    }
  };
}
