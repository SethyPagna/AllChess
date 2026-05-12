import Link from "next/link";

import { GameBoard } from "@/components/game-board";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);

  return (
    <div className="grid gap-8">
      <section className="grid items-center gap-8 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-6">
          <h1 className="max-w-3xl text-5xl font-black leading-tight sm:text-7xl">{t("app.name")}</h1>
          <p className="max-w-2xl text-xl leading-9 text-[var(--muted)]">{t("app.tagline")}</p>
          <div className="flex flex-wrap gap-3">
            <Link href={`/${locale}/lobby`} className="focus-ring rounded-md bg-[var(--accent)] px-5 py-3 font-bold text-black">
              {t("lobby.quickPair")}
            </Link>
            <Link href={`/${locale}/variants`} className="focus-ring rounded-md border border-[var(--border)] px-5 py-3 font-bold">
              {t("nav.variants")}
            </Link>
          </div>
        </div>
        <div className="glass rounded-lg p-3">
          <GameBoard variantKey="classic" />
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-4">
        {[
          [t("lobby.online"), "2,418"],
          [t("nav.variants"), "11"],
          [t("chess.replay"), "Live"],
          [t("play.analysis"), "AI"]
        ].map(([label, value]) => (
          <div key={label} className="panel p-4">
            <p className="text-sm text-[var(--muted)]">{label}</p>
            <p className="text-3xl font-black">{value}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
