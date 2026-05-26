import { GameBoard } from "@/components/board/game-board";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { parseBotDifficulty, parsePlayMode, parseQueryFlag, parseTimeControl } from "@/lib/routing/params";
import { formatVariantPlayMeta, getVariant } from "@/lib/variants";
import { getVariantRuleSummary } from "@/lib/variants/rules-atlas";

export const dynamic = "force-dynamic";

export default async function PlaySetupPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale: rawLocale } = await params;
  const query = searchParams ? await searchParams : {};
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const variant = getVariant("classic");
  const initialPlayMode = parsePlayMode(query.mode, "online") ?? "online";
  const initialBotDifficulty = parseBotDifficulty(query.bot);
  const initialTimeControl = parseTimeControl(query.time ?? query.clock, "rapid");
  const initialBotMode = initialBotDifficulty || parseQueryFlag(query.bot) || initialPlayMode === "bot" ? "opponent" : "human";

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
          locale={locale}
          title={t(variant.nameKey)}
          meta={formatVariantPlayMeta(variant)}
          objective={variant.objective}
        />
      </div>
    </section>
  );
}
