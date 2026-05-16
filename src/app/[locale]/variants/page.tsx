import Link from "next/link";
import { BookOpen, Bot, Brain, Database, Gauge, Play } from "lucide-react";

import { CatalogBrowser } from "@/components/catalog-browser";
import { InfoHint } from "@/components/info-hint";
import { getBotTrainingGateSummary, listBotKnowledgeSummary } from "@/lib/bot-training";
import { listBotStrengthBands } from "@/lib/bot-strength";
import { gameFamilies, getCatalogStats, getGameCatalog, type GameFamilyKey, type PlayabilityStatus } from "@/lib/catalog";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function VariantsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ family?: string; playability?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const query = (await searchParams) ?? {};
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const entries = getGameCatalog();
  const stats = getCatalogStats(entries);
  const knowledge = listBotKnowledgeSummary();
  const trainingGate = getBotTrainingGateSummary();
  const strengthBands = listBotStrengthBands();
  const legendBand = strengthBands[strengthBands.length - 1];
  const initialFamily = isGameFamily(query.family) ? query.family : "all";
  const initialStatus = isPlayability(query.playability) ? query.playability : "all";

  return (
    <section className="grid gap-6">
      <div className="practice-hero panel">
        <div>
          <p className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--muted)]">
            <BookOpen size={16} />
            Games, rules, and practice
          </p>
          <h1>{t("variants.title")}</h1>
          <p>{stats.playableGames} ready boards, {stats.learnGames} guides, {stats.comingSoonGames} in progress.</p>
        </div>
        <Link href={`/${locale}/play/classic?bot=normal&mode=bot`} className="focus-ring action-primary inline-flex items-center gap-2 px-4 py-3">
          <Play size={18} />
          Quick bot game
        </Link>
      </div>
      <div className="panel practice-bot-metrics" aria-label="Bot training status">
        <div>
          <span>
            <Database size={16} />
            Book & tactics
            <InfoHint text="Cached openings and tactical patterns are checked before live search." />
          </span>
          <strong>{knowledge.entries.toLocaleString()}</strong>
          <small>{knowledge.tacticEntries.toLocaleString()} tactics</small>
        </div>
        <div>
          <span>
            <Brain size={16} />
            Move labels
            <InfoHint text="Compact records rank candidate moves before the bot spends time searching." />
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
            <Bot size={16} />
            Release gate
            <InfoHint text={trainingGate.notice} />
          </span>
          <strong>{trainingGate.playableVariants.length} ready</strong>
          <small>{trainingGate.gatedVariants.length} not fully trained</small>
        </div>
      </div>
      <CatalogBrowser entries={entries} initialFamily={initialFamily} initialStatus={initialStatus} locale={locale} />
    </section>
  );
}

function isGameFamily(value: string | undefined): value is GameFamilyKey {
  return Boolean(value && gameFamilies.some((family) => family.key === value));
}

function isPlayability(value: string | undefined): value is PlayabilityStatus {
  return value === "playable" || value === "learn" || value === "coming-soon";
}
