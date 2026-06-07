import { GameBoard } from "@/components/board/game-board";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createPageMetadata } from "@/lib/metadata/page-metadata";
import { parseBotDifficulty, parsePlayMode, parseQueryFlag, parseTimeControl } from "@/lib/routing/params";
import { getVariant } from "@/lib/variants";
import { getVariantRuleSummary } from "@/lib/variants/rules-atlas";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  return createPageMetadata(locale, t("nav.play"));
}

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
