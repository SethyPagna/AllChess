import { notFound } from "next/navigation";
import { Eye, Flag, Handshake, Radio, Share2 } from "lucide-react";

import { GameBoard } from "@/components/game-board";
import { RulesSummaryButton } from "@/components/rules-summary-button";
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
        <div className="play-context play-header-compact">
          <div>
            <h1>{t(variant.nameKey)}</h1>
            <p className="inline-flex items-center gap-2 rounded-md bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--muted)]">
              <Radio size={14} />
              {variant.rulesAdapter} / {variant.engineProtocol.toUpperCase()}
            </p>
          </div>
          <p className="play-objective">{variant.objective}</p>
          <div className="play-header-actions">
            <RulesSummaryButton summary={getVariantRuleSummary(variant.key)} />
            <button className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm">
              <Share2 size={16} />
              Room
            </button>
            <button className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm">
              <Eye size={16} />
              Watch
            </button>
            <button className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm">
              <Handshake size={16} />
              Draw
            </button>
            <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-[var(--danger)] px-3 py-2 text-sm font-bold text-[var(--danger)]">
              <Flag size={16} />
              Resign
            </button>
          </div>
        </div>

        <GameBoard
          variantKey={variant.key}
          rulesSummary={getVariantRuleSummary(variant.key)}
          initialBotMode={query.bot || initialPlayMode === "bot" ? "opponent" : "human"}
          initialPlayMode={initialPlayMode as "online" | "bot" | "offline" | "room" | "matchmaking" | "spectate" | undefined}
        />
      </div>
    </section>
  );
}
