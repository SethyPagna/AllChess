import Link from "next/link";
import { Bot, Clock3, Swords } from "lucide-react";

import { InfoHint } from "@/components/ui/info-hint";
import { PlayGamePicker } from "@/components/play/game-picker";
import { playModeOptions, playQuickActions, playWorkflowSteps } from "@/components/play/play-setup-options";
import { getRuntimeCatalogEntries } from "@/lib/catalog/runtime";
import { timeControls } from "@/lib/game/time-controls";
import { normalizeLocale } from "@/lib/i18n/locales";
import { playGameHref, playSetupHref } from "@/lib/routing/play-links";
import { parsePlayMode, parseTimeControl } from "@/lib/routing/params";

export const dynamic = "force-dynamic";

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
  const selectedModeLabel = playModeOptions.find((mode) => mode.key === selectedMode)?.label ?? "Online";
  const selectedTimeLabel = timeControls.find((control) => control.key === selectedTimeControl)?.label ?? "Rapid 10+0";
  const playable = (await getRuntimeCatalogEntries()).filter((entry) => entry.playability === "playable" && entry.variantKey);

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
        <Link href={playGameHref(locale, "classic", { mode: "bot", time: "rapid" }) as never} className="focus-ring action-primary inline-flex items-center gap-2 px-4 py-3">
          <Bot size={18} />
          Quick bot game
        </Link>
      </div>
      <div className="play-workflow-strip" aria-label="Play workflow">
        {playWorkflowSteps.map((step) => (
          <div key={step.label} className="play-workflow-step">
            <strong>{step.label}</strong>
            <InfoHint text={step.detail} />
          </div>
        ))}
      </div>
      <div className="play-quick-grid" aria-label="Fast play actions">
        {playQuickActions.map(({ label, detail, Icon, mode }) => (
          <Link key={label} href={playGameHref(locale, "classic", { mode, time: "rapid" }) as never} className="focus-ring play-quick-card">
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
            {playModeOptions.map(({ key, label, description, Icon }) => (
              <Link key={key} href={playSetupHref(locale, { mode: key, time: selectedTimeControl }) as never} className={`focus-ring play-mode-rail-item ${selectedMode === key ? "is-selected" : ""}`} aria-current={selectedMode === key ? "page" : undefined}>
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
                href={playSetupHref(locale, { mode: selectedMode, time: control.key }) as never}
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
