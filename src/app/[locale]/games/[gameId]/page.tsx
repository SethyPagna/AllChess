import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { GameDetailGate } from "@/components/games/game-detail-gate";
import { GameDetailHero } from "@/components/games/game-detail-hero";
import { GameDetailRuleSections } from "@/components/games/game-detail-rule-sections";
import { GameDetailSources } from "@/components/games/game-detail-sources";
import { parseCatalogMode, safeDecodeRouteSegment } from "@/lib/routing/params";
import { gameFamilies, getCatalogModeSupport } from "@/lib/catalog";
import { getRuntimeCatalogEntry } from "@/lib/catalog/runtime";
import { listBotTrainingReadiness } from "@/lib/bot/training";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createPageMetadata } from "@/lib/metadata/page-metadata";
import { findVariantRuleCompletion } from "@/lib/variants/rules-atlas";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; gameId: string }> }) {
  const { locale: rawLocale, gameId } = await params;
  const locale = normalizeLocale(rawLocale);
  const decodedGameId = safeDecodeRouteSegment(gameId);
  const entry = decodedGameId ? await getRuntimeCatalogEntry(decodedGameId) : undefined;
  return createPageMetadata(locale, entry ? entry.name.english : createTranslator(locale)("nav.variants"), entry?.shortRules[0]);
}

export default async function GameDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; gameId: string }>;
  searchParams?: Promise<{ mode?: string }>;
}) {
  const { locale: rawLocale, gameId } = await params;
  const query = (await searchParams) ?? {};
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const decodedGameId = safeDecodeRouteSegment(gameId);
  const entry = decodedGameId ? await getRuntimeCatalogEntry(decodedGameId) : undefined;
  if (!entry) notFound();
  const family = gameFamilies.find((item) => item.key === entry.family);
  const completion = entry.variantKey ? findVariantRuleCompletion(entry.variantKey) : null;
  const readiness = entry.variantKey ? listBotTrainingReadiness(entry.variantKey)[0] : null;
  const isGated = completion?.status !== "verified-playable" || readiness?.coverageStatus === "rules-gated";

  return (
    <section className="cm-page game-page">
      <Link href={`/${locale}/variants`} className="cm-link cm-crumb focus-ring">
        <ChevronLeft size={15} aria-hidden="true" />
        {t("nav.variants")}
      </Link>
      <GameDetailHero entry={entry} family={family} locale={locale} mode={parseCatalogMode(query.mode ?? null)} />
      {isGated ? <GameDetailGate previewAvailable={getCatalogModeSupport(entry, "offline").enabled} /> : null}
      <div className="game-sections">
        <GameDetailRuleSections entry={entry} />
      </div>
      <GameDetailSources sources={entry.ruleSourceLinks} />
    </section>
  );
}
