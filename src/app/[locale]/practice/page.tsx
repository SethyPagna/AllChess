import Link from "next/link";
import { BookOpen, Bot, Brain, Database, Gauge, Play, Swords } from "lucide-react";

import { InfoHint } from "@/components/info-hint";
import { displayBotReadiness, displayGameName, displayRulesReadiness, gameFamilies, getGameCatalog } from "@/lib/catalog";
import { getBotTrainingGateSummary, listBotKnowledgeSummary, listBotTrainingReadiness } from "@/lib/bot-training";
import { listBotStrengthBands } from "@/lib/bot-strength";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function PracticePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const variantEntries = getGameCatalog().filter((entry) => entry.variantKey);
  const knowledge = listBotKnowledgeSummary();
  const readinessByVariant = new Map(listBotTrainingReadiness().map((readiness) => [readiness.variantKey, readiness]));
  const trainingGate = getBotTrainingGateSummary();
  const strengthBands = listBotStrengthBands();
  const legendBand = strengthBands[strengthBands.length - 1];

  return (
    <section className="practice-page grid gap-5">
      <div className="practice-hero panel">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--muted)]">
            <Bot size={16} />
            Bot practice
          </p>
          <h1>Choose a game, then train</h1>
          <p>Pick the board first. The play screen opens with bot opponent on, random side enabled, and difficulty available during the game.</p>
        </div>
        <Link href={`/${locale}/play/classic?bot=normal`} className="focus-ring action-primary inline-flex items-center gap-2 px-4 py-3">
          <Play size={18} />
          Quick chess bot
        </Link>
      </div>
      <div className="panel practice-bot-metrics" aria-label="Bot training status">
        <div>
          <span>
            <Database size={16} />
            Book & tactics
            <InfoHint text="Cached openings and tactical patterns are checked before live search, so known positions answer faster." />
          </span>
          <strong>{knowledge.entries.toLocaleString()}</strong>
          <small>{knowledge.tacticEntries.toLocaleString()} tactics</small>
        </div>
        <div>
          <span>
            <Brain size={16} />
            Move labels
            <InfoHint text="Compact records from local tools rank candidate moves before the bot spends time searching." />
          </span>
          <strong>{knowledge.engineLabels.toLocaleString()}</strong>
          <small>{knowledge.toolsDiscovered} sources indexed</small>
        </div>
        <div>
          <span>
            <Gauge size={16} />
            Legend
            <InfoHint text={legendBand.basis} />
          </span>
          <strong>{legendBand.display}</strong>
          <small>{legendBand.calibrationStatus.replace(/-/g, " ")}</small>
        </div>
        <div>
          <span>
            <BookOpen size={16} />
            Release gate
            <InfoHint text={trainingGate.notice} />
          </span>
          <strong>{trainingGate.playableVariants.length} ready</strong>
          <small>{trainingGate.gatedVariants.length} not fully trained</small>
        </div>
      </div>
      <div className="practice-grid">
        {variantEntries.map((entry) => {
          const variantKey = entry.variantKey;
          if (!variantKey) return null;
          const readiness = readinessByVariant.get(variantKey);

          return (
            <article key={entry.id} className="panel practice-card">
              <div>
                <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">{gameFamilies.find((family) => family.key === entry.family)?.label}</p>
                <h2>{displayGameName(entry)}</h2>
                <p>{entry.board.description}</p>
              </div>
              <div className="practice-readiness" data-status={readiness?.coverageStatus ?? "training"} title={readiness?.primaryGap}>
                <strong>{readiness?.badgeLabel ?? "Search ready"}</strong>
                <span>{readiness?.coverageStatus === "rules-gated" ? "not fully trained" : `${(readiness?.knowledgeEntries ?? 0).toLocaleString()} cached`}</span>
                <span>{(readiness?.responseTargetMs ?? 2800) / 1000}s target</span>
              </div>
              <div className="practice-card-meta">
                <span>
                  <Swords size={15} />
                  {displayRulesReadiness(entry)}
                </span>
                <span>
                  <Brain size={15} />
                  {displayBotReadiness(entry)}
                </span>
              </div>
              {entry.playability === "playable" ? (
                <Link href={`/${locale}/play/${variantKey}?bot=normal`} className="focus-ring action-secondary inline-flex items-center justify-center gap-2 px-3 py-2 text-sm">
                  <Bot size={16} />
                  Practice
                </Link>
              ) : (
                <Link href={`/${locale}/games/${entry.id}`} className="focus-ring action-secondary inline-flex items-center justify-center gap-2 px-3 py-2 text-sm">
                  <BookOpen size={16} />
                  Rules gate
                </Link>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
