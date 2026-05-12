import { notFound } from "next/navigation";

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
        </div>
        <div className="flex gap-2">
          <button className="focus-ring rounded-md border border-[var(--border)] px-4 py-2">{t("play.draw")}</button>
          <button className="focus-ring rounded-md border border-[var(--danger)] px-4 py-2 text-[var(--danger)]">{t("play.resign")}</button>
        </div>
      </div>
      <GameBoard variantKey={variant.key} />
    </section>
  );
}
