import { Bot, Crown, Eye, Flag, Swords, type LucideIcon } from "lucide-react";

export type PlayMode = "online" | "bot" | "offline" | "room" | "spectate";

export const playModeOptions: Array<{ key: PlayMode; label: string; description: string; Icon: LucideIcon }> = [
  { key: "online", label: "Quick Match", description: "Find a casual opponent", Icon: Swords },
  { key: "bot", label: "Bot Mode", description: "Train by tier", Icon: Bot },
  { key: "offline", label: "Offline Local", description: "Same device", Icon: Crown },
  { key: "room", label: "Play a Friend", description: "Invite by code", Icon: Flag },
  { key: "spectate", label: "Spectate", description: "Watch rooms", Icon: Eye }
];
