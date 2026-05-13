import { notFound } from "next/navigation";
import { Flag, Handshake, Radio } from "lucide-react";

import { GameBoard } from "@/components/game-board";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
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
        <div className="flex gap-2">
          <button className="focus-ring action-secondary inline-flex items-center gap-2 px-4 py-2">
            <Handshake size={16} />
            {t("play.draw")}
          </button>
          <button className="focus-ring inline-flex items-center gap-2 rounded-md border border-[var(--danger)] px-4 py-2 text-[var(--danger)]">
            <Flag size={16} />
            {t("play.resign")}
          </button>
        </div>
      </div>
      <GameBoard variantKey={variant.key} />
    </section>
  );
}
