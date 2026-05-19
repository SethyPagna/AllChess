import Link from "next/link";
import { Bot, Clock3, Eye, Globe2, Handshake, Lock, MonitorSmartphone, Swords, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { InfoHint } from "@/components/info-hint";
import { PlayGamePicker } from "@/components/play-game-picker";
import { getGameCatalog } from "@/lib/catalog";
import { timeControls } from "@/lib/game/time-controls";
import { normalizeLocale } from "@/lib/i18n/locales";
import { parsePlayMode, parseTimeControl, type PlayModeKey } from "@/lib/routing/params";

const playModes: Array<{ key: PlayModeKey; label: string; description: string; Icon: LucideIcon }> = [
  { key: "online", label: "Online", description: "Queue for a live opponent with matching settings.", Icon: Globe2 },
  { key: "bot", label: "Bots", description: "Train from Easy through Legend with side choice.", Icon: Bot },
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
  { label: "Play 10 min", detail: "Rapid setup", Icon: Clock3, hrefSuffix: "?mode=online&time=rapid" },
  { label: "New Game", detail: "Classic local setup", Icon: Swords, hrefSuffix: "?mode=offline&time=rapid" },
  { label: "Bot Mode", detail: "Choose tier and clock", Icon: Bot, hrefSuffix: "?bot=normal&mode=bot&time=rapid" },
  { label: "Play a Friend", detail: "Room invite", Icon: Handshake, hrefSuffix: "?mode=room&time=rapid" }
];

export default async function PlaySetupPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ mode?: string; time?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const query = await searchParams;
  const locale = normalizeLocale(rawLocale);
  const selectedMode = parsePlayMode(query?.mode, "online") ?? "online";
  const selectedTimeControl = parseTimeControl(query?.time, "rapid") ?? "rapid";
  const selectedModeLabel = playModes.find((mode) => mode.key === selectedMode)?.label ?? "Online";
  const selectedTimeLabel = timeControls.find((control) => control.key === selectedTimeControl)?.label ?? "Rapid 10+0";
  const playable = getGameCatalog().filter((entry) => entry.playability === "playable" && entry.variantKey);

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
        <Link href={`/${locale}/play/classic?bot=normal&mode=bot&time=rapid`} className="focus-ring action-primary inline-flex items-center gap-2 px-4 py-3">
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
              <Link key={key} href={`/${locale}/play?mode=${key}&time=${selectedTimeControl}`} className={`focus-ring play-mode-rail-item ${selectedMode === key ? "is-selected" : ""}`} aria-current={selectedMode === key ? "page" : undefined}>
                <Icon size={18} />
                <span>{label}</span>
                <InfoHint text={description} />
              </Link>
            ))}
          </div>
          <div className="compact-section-heading mt-4">
            <h2 className="section-title">Clock</h2>
            <InfoHint text={`Selected: ${selectedTimeLabel}. The chosen clock follows each game link.`} />
          </div>
          <div className="play-mode-rail-list" aria-label="Time controls">
            {timeControls.map((control) => (
              <Link
                key={control.key}
                href={`/${locale}/play?mode=${selectedMode}&time=${control.key}`}
                className={`focus-ring play-mode-rail-item ${selectedTimeControl === control.key ? "is-selected" : ""}`}
                aria-current={selectedTimeControl === control.key ? "page" : undefined}
              >
                <Clock3 size={18} />
                <span>{control.label}</span>
                <InfoHint text={control.description} />
              </Link>
            ))}
          </div>
        </aside>
        <div className="panel play-game-picker">
          <div className="compact-section-heading">
            <h2 className="section-title">Game</h2>
            <InfoHint text="Pick a ruleset. Use the info button for basics, endings, status, bot mode, and the full guide." />
          </div>
          <PlayGamePicker entries={playable} locale={locale} selectedMode={selectedMode} selectedTimeControl={selectedTimeControl} />
        </div>
      </div>
    </section>
  );
}
