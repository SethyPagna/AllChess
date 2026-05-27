import Link from "next/link";
import { LogIn, Swords } from "lucide-react";

import { IntroBoard } from "@/components/home/intro-board";
import { IntroNavigation } from "@/components/home/intro-navigation";
import { getCatalogStats } from "@/lib/catalog";
import { getRuntimeCatalogEntries } from "@/lib/catalog/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { playSetupHref } from "@/lib/routing/play-links";

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const catalogStats = getCatalogStats(await getRuntimeCatalogEntries());

  return (
    <div className="intro-page">
      <section className="intro-hero" aria-label="AllChess intro">
        <div className="intro-copy">
          <h1>{t("app.name")}</h1>
          <p>Play first. Learn as you go. Sign in only when you want your games saved.</p>
          <div className="intro-actions">
            <Link href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never} className="focus-ring action-primary inline-flex items-center gap-2 px-5 py-3">
              <Swords size={18} />
              Start playing
            </Link>
            <Link href={`/${locale}/login`} className="focus-ring action-secondary inline-flex items-center gap-2 px-5 py-3">
              <LogIn size={18} />
              Sign in
            </Link>
          </div>
          <div className="intro-proof" aria-label="Intro stats">
            <span>{catalogStats.playableGames} ready games</span>
            <span>{catalogStats.learnGames + catalogStats.comingSoonGames} guides</span>
            <span>Live data only</span>
          </div>
        </div>

        <IntroBoard />
      </section>

      <IntroNavigation locale={locale} />
    </div>
  );
}
