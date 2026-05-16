import { notFound } from "next/navigation";

import { GameBoard } from "@/components/game-board";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
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
  let variant;
  try {
    variant = getVariant(gameId);
  } catch {
    notFound();
  }
  const rawMode = Array.isArray(query.mode) ? query.mode[0] : query.mode;
  const initialPlayMode = ["online", "bot", "offline", "room", "matchmaking", "spectate"].includes(rawMode ?? "") ? rawMode : undefined;

  return (
    <section className="play-arena">
      <div className="play-core grid gap-3">
        <GameBoard
          variantKey={variant.key}
          rulesSummary={getVariantRuleSummary(variant.key)}
          initialBotMode={query.bot || initialPlayMode === "bot" ? "opponent" : "human"}
          initialPlayMode={initialPlayMode as "online" | "bot" | "offline" | "room" | "matchmaking" | "spectate" | undefined}
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
