import Link from "next/link";
import { Bot, Brain, Database, Gauge, Play, Swords } from "lucide-react";

import { InfoHint } from "@/components/info-hint";
import { displayGameName, gameFamilies, getGameCatalog } from "@/lib/catalog";
import { listBotKnowledgeSummary } from "@/lib/bot-training";
import { listBotStrengthBands } from "@/lib/bot-strength";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function PracticePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const playable = getGameCatalog().filter((entry) => entry.playability === "playable" && entry.variantKey);
  const knowledge = listBotKnowledgeSummary();
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
            Knowledge
            <InfoHint text="Cached openings and tactics are checked before live search, so known positions answer faster." />
          </span>
          <strong>{knowledge.entries.toLocaleString()}</strong>
          <small>{knowledge.tacticEntries.toLocaleString()} tactics</small>
        </div>
        <div>
          <span>
            <Brain size={16} />
            Labels
            <InfoHint text="Engine labels are compact training records distilled from local data and tools." />
          </span>
          <strong>{knowledge.engineLabels.toLocaleString()}</strong>
          <small>{knowledge.toolsDiscovered} tools linked</small>
        </div>
        <div>
          <span>
            <Gauge size={16} />
            Top tier
            <InfoHint text={legendBand.basis} />
          </span>
          <strong>{legendBand.display}</strong>
          <small>{legendBand.calibrationStatus.replace(/-/g, " ")}</small>
        </div>
      </div>
      <div className="practice-grid">
        {playable.map((entry) => (
          <article key={entry.id} className="panel practice-card">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">{gameFamilies.find((family) => family.key === entry.family)?.label}</p>
              <h2>{displayGameName(entry)}</h2>
              <p>{entry.board.description}</p>
            </div>
            <div className="practice-card-meta">
              <span>
                <Swords size={15} />
                {entry.rulesAdapter}
              </span>
              <span>
                <Brain size={15} />
                {entry.botAdapter}
              </span>
            </div>
            <Link href={`/${locale}/play/${entry.variantKey}?bot=normal`} className="focus-ring action-secondary inline-flex items-center justify-center gap-2 px-3 py-2 text-sm">
              <Bot size={16} />
              Practice
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
