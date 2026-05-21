import { InfoHint } from "@/components/ui/info-hint";
import { PlayGamePicker } from "@/components/play/game-picker";
import { PlayModeRail, PlayQuickGrid, PlaySetupHero, PlayWorkflowStrip } from "@/components/play/play-setup-panels";
import { playModeOptions } from "@/components/play/play-setup-options";
import { getRuntimeCatalogEntries } from "@/lib/catalog/runtime";
import { timeControls } from "@/lib/game/time-controls";
import { normalizeLocale } from "@/lib/i18n/locales";
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
      <PlaySetupHero locale={locale} />
      <PlayWorkflowStrip />
      <PlayQuickGrid locale={locale} />
      <div className="play-setup-shell">
        <PlayModeRail locale={locale} selectedMode={selectedMode} selectedModeLabel={selectedModeLabel} selectedTimeControl={selectedTimeControl} selectedTimeLabel={selectedTimeLabel} />
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
