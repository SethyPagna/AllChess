import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { GameDetailGate } from "@/components/games/game-detail-gate";
import { GameDetailHero } from "@/components/games/game-detail-hero";
import { GameDetailRuleSections } from "@/components/games/game-detail-rule-sections";
import { GameDetailSources } from "@/components/games/game-detail-sources";
import { safeDecodeRouteSegment } from "@/lib/routing/params";
import { gameFamilies } from "@/lib/catalog";
import { getRuntimeCatalogEntry } from "@/lib/catalog/runtime";
import { listBotTrainingReadiness } from "@/lib/bot/training";
import { normalizeLocale } from "@/lib/i18n/locales";
import { findVariantRuleCompletion } from "@/lib/variants/rules-atlas";

export const dynamic = "force-dynamic";

export default async function GameDetailPage({ params }: { params: Promise<{ locale: string; gameId: string }> }) {
  const { locale: rawLocale, gameId } = await params;
  const locale = normalizeLocale(rawLocale);
  const decodedGameId = safeDecodeRouteSegment(gameId);
  const entry = decodedGameId ? await getRuntimeCatalogEntry(decodedGameId) : undefined;
  if (!entry) notFound();
  const family = gameFamilies.find((item) => item.key === entry.family);
  const completion = entry.variantKey ? findVariantRuleCompletion(entry.variantKey) : null;
  const readiness = entry.variantKey ? listBotTrainingReadiness(entry.variantKey)[0] : null;
  const isGated = completion?.status !== "verified-playable" || readiness?.coverageStatus === "rules-gated";

  return (
    <section className="game-detail">
      <Link href={`/${locale}/variants`} className="action-secondary focus-ring inline-flex items-center gap-2 px-3 py-2 text-sm">
        <ArrowLeft size={16} />
        Games & rules
      </Link>
      <GameDetailHero entry={entry} family={family} locale={locale} />
      {isGated ? (
        <GameDetailGate primaryGap={readiness?.primaryGap ?? completion?.remainingGates[0]} />
      ) : null}
      <div className="game-detail-grid">
        <GameDetailRuleSections completion={completion} entry={entry} />
        <GameDetailSources sources={entry.ruleSourceLinks} />
      </div>
    </section>
  );
}
