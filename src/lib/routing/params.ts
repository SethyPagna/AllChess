import { botDifficultyLevels, type BotDifficultyKey } from "@/lib/bot/config";
import { gameFamilies, type GameFamilyKey, type PlayabilityStatus } from "@/lib/catalog";
import { timeControls, type TimeControlKey } from "@/lib/game/time-controls";

const playabilityStatuses: PlayabilityStatus[] = ["playable", "learn", "coming-soon"];
const playModes = ["online", "bot", "offline", "room", "spectate"] as const;
const truthyQueryValues = new Set(["1", "true", "yes", "on"]);

export type PlayModeKey = (typeof playModes)[number];

export function parseCatalogFamily(value: string | null): GameFamilyKey | undefined {
  if (!value) return undefined;
  return gameFamilies.some((family) => family.key === value) ? (value as GameFamilyKey) : undefined;
}

export function parsePlayabilityStatus(value: string | null): PlayabilityStatus | undefined {
  if (!value) return undefined;
  return playabilityStatuses.includes(value as PlayabilityStatus) ? (value as PlayabilityStatus) : undefined;
}

export function parsePlayMode(value: string | string[] | undefined, fallback?: PlayModeKey): PlayModeKey | undefined {
  const mode = Array.isArray(value) ? value[0] : value;
  if (!mode) return fallback;
  if (mode === "matchmaking") return "online";
  return playModes.includes(mode as PlayModeKey) ? (mode as PlayModeKey) : fallback;
}

export function parseQueryFlag(value: string | string[] | undefined) {
  const flag = Array.isArray(value) ? value[0] : value;
  return Boolean(flag && truthyQueryValues.has(flag.toLowerCase()));
}

export function parseBotDifficulty(value: string | string[] | undefined, fallback?: BotDifficultyKey): BotDifficultyKey | undefined {
  const difficulty = Array.isArray(value) ? value[0] : value;
  if (!difficulty) return fallback;
  return botDifficultyLevels.some((level) => level.key === difficulty) ? (difficulty as BotDifficultyKey) : fallback;
}

export function parseTimeControl(value: string | string[] | undefined, fallback?: TimeControlKey): TimeControlKey | undefined {
  const timeControl = Array.isArray(value) ? value[0] : value;
  if (!timeControl) return fallback;
  return timeControls.some((control) => control.key === timeControl) ? (timeControl as TimeControlKey) : fallback;
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

export function safeDecodeQueryValue(value: string | undefined, options: { malformedFallback?: string | null } = {}) {
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return options.malformedFallback ?? null;
  }
}
