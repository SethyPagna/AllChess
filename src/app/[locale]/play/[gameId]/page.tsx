import { notFound } from "next/navigation";
import { Eye, Flag, Handshake, Radio, Share2, Users } from "lucide-react";

import { GameBoard } from "@/components/game-board";
import { RulesPanel } from "@/components/rules-panel";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getVariantRuleSummary } from "@/lib/rules-atlas";
import { getVariant } from "@/lib/variants";

export default async function PlayPage({
  params
}: {
  params: Promise<{ locale: string; gameId: string }>;
}) {
  const { locale: rawLocale, gameId } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  let variant;
  try {
    variant = getVariant(gameId);
  } catch {
    notFound();
  }

  return (
    <section className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-black">{t(variant.nameKey)}</h1>
          <p className="text-[var(--muted)]">{variant.objective}</p>
          <p className="mt-2 inline-flex items-center gap-2 rounded-md bg-[var(--surface-soft)] px-3 py-2 text-xs font-bold text-[var(--muted)]">
            <Radio size={14} />
            {variant.rulesAdapter} · {variant.engineProtocol.toUpperCase()}
          </p>
        </div>
        <div className="flex max-w-full flex-wrap gap-2">
          <button className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm sm:px-4 sm:text-base">
            <Share2 size={16} />
            Room
          </button>
          <button className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm sm:px-4 sm:text-base">
            <Eye size={16} />
            Spectate
          </button>
          <button className="focus-ring action-secondary inline-flex items-center gap-2 px-3 py-2 text-sm sm:px-4 sm:text-base">
            <Handshake size={16} />
            {t("play.draw")}
          </button>
          <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-[var(--danger)] px-3 py-2 text-sm text-[var(--danger)] sm:px-4 sm:text-base">
            <Flag size={16} />
            {t("play.resign")}
          </button>
        </div>
      </div>
      <div className="panel flex flex-wrap items-center gap-2 p-3 text-sm text-[var(--muted)]">
        <Users size={16} className="text-[var(--accent)]" />
        Realtime-ready room: authoritative moves, reconnect snapshots, spectators, clocks, and bot seats use the server room protocol.
      </div>
      <GameBoard variantKey={variant.key} />
      <RulesPanel summary={getVariantRuleSummary(variant.key)} compact />
    </section>
  );
}
