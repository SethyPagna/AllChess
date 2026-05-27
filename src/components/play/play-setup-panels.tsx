import Link from "next/link";
import { Bot, Clock3, Swords } from "lucide-react";

import { InfoHint } from "@/components/ui/info-hint";
import { timeControls, type TimeControlKey } from "@/lib/game/time-controls";
import { playGameHref, playSetupHref } from "@/lib/routing/play-links";
import type { PlayModeKey } from "@/lib/routing/params";
import { playModeOptions, playQuickActions, playWorkflowSteps } from "./play-setup-options";

type PlaySetupLocaleProps = {
  locale: string;
};

type PlayModeRailProps = PlaySetupLocaleProps & {
  selectedMode: PlayModeKey;
  selectedModeLabel: string;
  selectedTimeControl: TimeControlKey;
  selectedTimeLabel: string;
};

export function PlaySetupHero({ locale }: PlaySetupLocaleProps) {
  return (
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
  );
}

export function PlayWorkflowStrip() {
  return (
    <div className="play-workflow-strip" aria-label="Play workflow">
      {playWorkflowSteps.map((step) => (
        <div key={step.label} className="play-workflow-step">
          <strong>{step.label}</strong>
          <InfoHint text={step.detail} />
        </div>
      ))}
    </div>
  );
}

export function PlayQuickGrid({ locale }: PlaySetupLocaleProps) {
  return (
    <div className="play-quick-grid" aria-label="Fast play actions">
      {playQuickActions.map(({ label, detail, Icon, mode }) => (
        <Link key={label} href={playGameHref(locale, "classic", { mode, time: "rapid" }) as never} className="focus-ring play-quick-card">
          <Icon size={24} />
          <span>{label}</span>
          <InfoHint text={detail} />
        </Link>
      ))}
    </div>
  );
}

export function PlayModeRail({
  locale,
  selectedMode,
  selectedModeLabel,
  selectedTimeControl,
  selectedTimeLabel
}: PlayModeRailProps) {
  return (
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
  );
}
