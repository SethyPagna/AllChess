import { gameFamilies, type GameFamilyKey, type PlayabilityStatus } from "@/lib/catalog";

const playabilityStatuses: PlayabilityStatus[] = ["playable", "learn", "coming-soon"];

export function parseCatalogFamily(value: string | null): GameFamilyKey | undefined {
  if (!value) return undefined;
  return gameFamilies.some((family) => family.key === value) ? (value as GameFamilyKey) : undefined;
}

export function parsePlayabilityStatus(value: string | null): PlayabilityStatus | undefined {
  if (!value) return undefined;
  return playabilityStatuses.includes(value as PlayabilityStatus) ? (value as PlayabilityStatus) : undefined;
}

export function parseBoundedInteger(value: string | null, fallback: number, options: { min: number; max: number }) {
  const parsed = Number(value ?? fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(options.min, Math.min(Math.trunc(parsed), options.max));
}

export function safeDecodeRouteSegment(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}
