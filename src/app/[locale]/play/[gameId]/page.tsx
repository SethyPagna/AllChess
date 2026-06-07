import { notFound } from "next/navigation";

import { GameBoard } from "@/components/board/game-board";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createPageMetadata } from "@/lib/metadata/page-metadata";
import { parseBotDifficulty, parsePlayMode, parseQueryFlag, parseTimeControl, safeDecodeRouteSegment } from "@/lib/routing/params";
import { getVariantRuleSummary } from "@/lib/variants/rules-atlas";
import { getVariant } from "@/lib/variants";

export async function generateMetadata({ params }: { params: Promise<{ locale: string; gameId: string }> }) {
  const { locale: rawLocale, gameId } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const decodedGameId = safeDecodeRouteSegment(gameId);
  if (!decodedGameId) return createPageMetadata(locale, t("play.yourMove"));

  try {
    const variant = getVariant(decodedGameId);
    return createPageMetadata(locale, t(variant.nameKey));
  } catch {
    return createPageMetadata(locale, t("play.yourMove"));
  }
}

export default async function PlayPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string; gameId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: rawLocale, gameId } = await params;
  const query = searchParams ? await searchParams : {};
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const decodedGameId = safeDecodeRouteSegment(gameId);
  if (!decodedGameId) notFound();

  let variant;
  try {
    variant = getVariant(decodedGameId);
  } catch {
    notFound();
  }
  const initialPlayMode = parsePlayMode(query.mode);
  const initialBotDifficulty = parseBotDifficulty(query.bot);
  const initialTimeControl = parseTimeControl(query.time ?? query.clock);
  const initialBotMode = initialBotDifficulty || parseQueryFlag(query.bot) || initialPlayMode === "bot" ? "opponent" : "human";
  const initialRoomId = singleQueryValue(query.room);

  return (
    <section className="play-arena">
      <div className="play-core grid gap-3">
        <GameBoard
          variantKey={variant.key}
          rulesSummary={getVariantRuleSummary(variant.key)}
          initialBotMode={initialBotMode}
          initialBotDifficulty={initialBotDifficulty}
          initialPlayMode={initialPlayMode}
          initialTimeControl={initialTimeControl}
          initialRoomId={initialRoomId}
          locale={locale}
          title={t(variant.nameKey)}
        />
      </div>
    </section>
  );
}

function singleQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
