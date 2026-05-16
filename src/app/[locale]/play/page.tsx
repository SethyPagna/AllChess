import Link from "next/link";
import { BookOpen, Bot, Clock3, Eye, Globe2, Handshake, Lock, MonitorSmartphone, Radio, Swords, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { InfoHint } from "@/components/info-hint";
import { displayGameName, displayRulesReadiness, getGameCatalog } from "@/lib/catalog";
import { normalizeLocale } from "@/lib/i18n/locales";

type PlayModeKey = "online" | "bot" | "offline" | "room" | "matchmaking" | "spectate";

const playModes: Array<{ key: PlayModeKey; label: string; description: string; Icon: LucideIcon }> = [
  { key: "online", label: "Online", description: "Queue for a live opponent with matching settings.", Icon: Globe2 },
  { key: "bot", label: "Bots", description: "Practice from Easy through Legend with side choice.", Icon: Bot },
  { key: "offline", label: "Local", description: "Two players on the same device.", Icon: MonitorSmartphone },
  { key: "room", label: "Room", description: "Create a shareable room code for friends.", Icon: Lock },
  { key: "matchmaking", label: "Match", description: "Pick time, rating band, and rated/casual.", Icon: Users },
  { key: "spectate", label: "Watch", description: "Watch active public rooms and bot games.", Icon: Eye }
];

const workflowSteps = [
  { label: "1. Mode", detail: "Online, bot, local, room, match, or watch." },
  { label: "2. Game", detail: "Pick the ruleset you want to play." },
  { label: "3. Setup", detail: "Choose side, clock, bot tier, then start." }
];

const quickActions = [
  { label: "Play 10 min", detail: "Rapid setup", Icon: Clock3, hrefSuffix: "?mode=online" },
  { label: "New Game", detail: "Classic setup", Icon: Swords, hrefSuffix: "?mode=offline" },
  { label: "Play Bots", detail: "Choose tier", Icon: Bot, hrefSuffix: "?bot=normal&mode=bot" },
  { label: "Play a Friend", detail: "Room invite", Icon: Handshake, hrefSuffix: "?mode=room" }
];

export default async function PlaySetupPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ mode?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const query = await searchParams;
  const locale = normalizeLocale(rawLocale);
  const selectedMode = normalizePlayMode(query?.mode);
  const selectedModeLabel = playModes.find((mode) => mode.key === selectedMode)?.label ?? "Online";
  const playable = getGameCatalog().filter((entry) => entry.playability === "playable" && entry.variantKey);
  const featured = playable.slice(0, 10);

  return (
    <section className="play-setup-page grid gap-5">
      <div className="panel play-setup-hero">
        <div>
          <div className="compact-title-row">
            <Swords size={18} />
            <h1>Choose how you want to play</h1>
            <InfoHint text="Pick a mode, then choose game, side, time, and bot tier before the board starts." />
          </div>
        </div>
        <Link href={`/${locale}/play/classic?bot=normal&mode=bot`} className="focus-ring action-primary inline-flex items-center gap-2 px-4 py-3">
          <Bot size={18} />
          Quick bot game
        </Link>
      </div>
      <div className="play-workflow-strip" aria-label="Play workflow">
        {workflowSteps.map((step) => (
          <div key={step.label} className="play-workflow-step">
            <strong>{step.label}</strong>
            <InfoHint text={step.detail} />
          </div>
        ))}
      </div>
      <div className="play-quick-grid" aria-label="Fast play actions">
        {quickActions.map(({ label, detail, Icon, hrefSuffix }) => (
          <Link key={label} href={`/${locale}/play/classic${hrefSuffix}`} className="focus-ring play-quick-card">
            <Icon size={24} />
            <span>{label}</span>
            <InfoHint text={detail} />
          </Link>
        ))}
      </div>
      <div className="play-setup-shell">
        <aside className="panel play-mode-rail" aria-label="Play modes">
          <div className="compact-section-heading">
            <h2 className="section-title">Mode</h2>
            <InfoHint text={`Selected: ${selectedModeLabel}. Choose a mode first, then each game row starts with that session type.`} />
          </div>
          <div className="play-mode-rail-list">
            {playModes.map(({ key, label, description, Icon }) => (
              <Link key={key} href={`/${locale}/play?mode=${key}`} className={`focus-ring play-mode-rail-item ${selectedMode === key ? "is-selected" : ""}`} aria-current={selectedMode === key ? "page" : undefined}>
                <Icon size={18} />
                <span>{label}</span>
                <InfoHint text={description} />
              </Link>
            ))}
          </div>
        </aside>
        <div className="panel play-game-picker">
          <div className="compact-section-heading">
            <h2 className="section-title">Game</h2>
            <InfoHint text="Pick a ruleset. Each row has one fast bot action and one online setup action to avoid clutter." />
          </div>
          <div className="play-game-list">
            {featured.map((entry) => (
              <article key={entry.id} className="play-game-row">
                <div className="play-game-row-main">
                  <Radio size={16} />
                  <strong>{displayGameName(entry)}</strong>
                  <span>{displayRulesReadiness(entry)}</span>
                  <InfoHint text={entry.winConditions[0]} />
                </div>
                <div className="play-game-row-actions">
                  <Link href={`/${locale}/games/${entry.id}` as never} className="focus-ring action-secondary" title="Open the short rules guide">
                    <BookOpen size={14} />
                    Rules
                  </Link>
                  <Link href={gameModeHref(locale, entry.variantKey, selectedMode)} className="focus-ring action-primary">
                    {modeActionLabel(selectedMode)}
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function normalizePlayMode(mode: string | undefined): PlayModeKey {
  if (mode === "bot" || mode === "offline" || mode === "room" || mode === "matchmaking" || mode === "spectate") return mode;
  return "online";
}

function modeActionLabel(mode: PlayModeKey) {
  const labels: Record<PlayModeKey, string> = {
    online: "Play",
    bot: "Bot",
    offline: "Local",
    room: "Room",
    matchmaking: "Match",
    spectate: "Watch"
  };
  return labels[mode];
}

function gameModeHref(locale: string, variantKey: string | undefined, mode: PlayModeKey) {
  if (mode === "spectate") return `/${locale}/watch` as never;
  if (mode === "bot") return `/${locale}/play/${variantKey}?bot=normal&mode=bot` as never;
  return `/${locale}/play/${variantKey}?mode=${mode}` as never;
}
