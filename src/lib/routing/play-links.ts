import type { TimeControlKey } from "@/lib/game/time-controls";
import type { PlayModeKey } from "@/lib/routing/params";

type PlayLinkOptions = {
  mode?: PlayModeKey;
  time?: TimeControlKey;
  bot?: boolean;
};

const DEFAULT_PLAY_MODE: PlayModeKey = "online";
const DEFAULT_GAME_MODE: PlayModeKey = "offline";
const DEFAULT_TIME_CONTROL: TimeControlKey = "rapid";

export function playSetupHref(locale: string, options: PlayLinkOptions = {}) {
  const mode = options.mode ?? DEFAULT_PLAY_MODE;
  const time = options.time ?? DEFAULT_TIME_CONTROL;
  if (mode === "spectate") return `/${locale}/watch`;
  return `/${locale}/play?mode=${mode}&time=${time}`;
}

export function playGameHref(locale: string, variantKey: string | undefined, options: PlayLinkOptions = {}) {
  const mode = options.mode ?? DEFAULT_GAME_MODE;
  const time = options.time ?? DEFAULT_TIME_CONTROL;
  if (mode === "spectate") return `/${locale}/watch`;
  if (!variantKey) return playSetupHref(locale, { mode, time });
  if (mode === "bot" || options.bot) return `/${locale}/play/${variantKey}?bot=normal&mode=bot&time=${time}`;
  return `/${locale}/play/${variantKey}?mode=${mode}&time=${time}`;
}
