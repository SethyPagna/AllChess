import { Bot, Clock3, Eye, Globe2, Handshake, Lock, MonitorSmartphone, Swords, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import type { PlayModeKey } from "@/lib/routing/params";

export type PlayModeOption = {
  key: PlayModeKey;
  label: string;
  description: string;
  Icon: LucideIcon;
};

export type PlayWorkflowStep = {
  label: string;
  detail: string;
};

export type PlayQuickAction = {
  label: string;
  detail: string;
  Icon: LucideIcon;
  mode: PlayModeKey;
};

export const playModeOptions: PlayModeOption[] = [
  { key: "online", label: "Online", description: "Queue for a live opponent with matching settings.", Icon: Globe2 },
  { key: "bot", label: "Bots", description: "Train from Easy through Legend with side choice.", Icon: Bot },
  { key: "offline", label: "Local", description: "Two players on the same device.", Icon: MonitorSmartphone },
  { key: "room", label: "Room", description: "Create a shareable room code for friends.", Icon: Lock },
  { key: "matchmaking", label: "Match", description: "Pick time, rating band, and rated/casual.", Icon: Users },
  { key: "spectate", label: "Watch", description: "Watch active public rooms and bot games.", Icon: Eye }
];

export const playWorkflowSteps: PlayWorkflowStep[] = [
  { label: "1. Mode", detail: "Online, bot, local, room, match, or watch." },
  { label: "2. Game", detail: "Pick the ruleset you want to play." },
  { label: "3. Setup", detail: "Choose side, clock, bot tier, then start." }
];

export const playQuickActions: PlayQuickAction[] = [
  { label: "Play 10 min", detail: "Rapid setup", Icon: Clock3, mode: "online" },
  { label: "New Game", detail: "Classic local setup", Icon: Swords, mode: "offline" },
  { label: "Bot Mode", detail: "Choose tier and clock", Icon: Bot, mode: "bot" },
  { label: "Play a Friend", detail: "Room invite", Icon: Handshake, mode: "room" }
];
