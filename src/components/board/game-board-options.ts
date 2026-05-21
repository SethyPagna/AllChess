import { Activity, Bot, Crown, Eye, Flag, SlidersHorizontal, Swords, Timer, type LucideIcon } from "lucide-react";

export type PlayMode = "online" | "bot" | "offline" | "room" | "matchmaking" | "spectate";
export type PanelTab = "setup" | "status";

export const playModeOptions: Array<{ key: PlayMode; label: string; description: string; Icon: LucideIcon }> = [
  { key: "online", label: "Play Online", description: "Match with a player", Icon: Swords },
  { key: "bot", label: "Bot Mode", description: "Train by tier", Icon: Bot },
  { key: "offline", label: "Offline Local", description: "Same device", Icon: Crown },
  { key: "room", label: "Create Room", description: "Invite by code", Icon: Flag },
  { key: "matchmaking", label: "Matchmaking", description: "Queue by settings", Icon: Timer },
  { key: "spectate", label: "Spectate", description: "Watch rooms", Icon: Eye }
];

export const panelTabOptions: Array<{ key: PanelTab; label: string; Icon: LucideIcon }> = [
  { key: "setup", label: "Setup", Icon: SlidersHorizontal },
  { key: "status", label: "Status", Icon: Activity }
];
