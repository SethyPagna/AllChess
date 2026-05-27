export type ObjectStoragePut = {
  key: string;
  body: ArrayBuffer | Blob | ReadableStream | Uint8Array | string | null;
  contentType?: string;
};

export type ObjectStorageObject = {
  key: string;
  url: string;
  contentType?: string;
};

export type ObjectStorage = {
  put(input: ObjectStoragePut): Promise<ObjectStorageObject>;
  getUrl(key: string): string;
};

export function normalizeObjectKey(key: string) {
  const cleanKey = key.replace(/^\/+/, "");
  return cleanKey.startsWith("allchess/") ? cleanKey : `allchess/${cleanKey}`;
}

export function createPublicObjectUrl(baseUrl: string | undefined, key: string) {
  const cleanKey = normalizeObjectKey(key);
  if (!baseUrl) return `/api/objects/${cleanKey}`;
  return `${baseUrl.replace(/\/$/, "")}/${cleanKey}`;
}
