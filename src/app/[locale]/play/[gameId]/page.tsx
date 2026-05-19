import { notFound } from "next/navigation";

import { GameBoard } from "@/components/game-board";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { parsePlayMode, parseQueryFlag, safeDecodeRouteSegment } from "@/lib/routing/params";
import { getVariantRuleSummary } from "@/lib/rules-atlas";
import { getVariant } from "@/lib/variants";

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
  const initialBotMode = parseQueryFlag(query.bot) || initialPlayMode === "bot" ? "opponent" : "human";

  return (
    <section className="play-arena">
      <div className="play-core grid gap-3">
        <GameBoard
          variantKey={variant.key}
          rulesSummary={getVariantRuleSummary(variant.key)}
          initialBotMode={initialBotMode}
          initialPlayMode={initialPlayMode}
          title={t(variant.nameKey)}
          meta={formatPlayMeta(variant)}
          objective={variant.objective}
        />
      </div>
    </section>
  );
}
function formatPlayMeta(variant: ReturnType<typeof getVariant>) {
  const engineLabel = variant.engineProtocol === "internal" ? "AllChess bot" : "Engine-assisted bot";
  return `Rules checked / ${engineLabel}`;
}
