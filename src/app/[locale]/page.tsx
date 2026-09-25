import Link from "next/link";
import { ArrowUpRight, Bot, Swords } from "lucide-react";

import { IntroBoard } from "@/components/home/intro-board";
import { GameLibrary } from "@/components/home/game-library";
import { getCatalogStats } from "@/lib/catalog";
import { getRuntimeCatalogEntries } from "@/lib/catalog/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createPageMetadata } from "@/lib/metadata/page-metadata";
import { playSetupHref } from "@/lib/routing/play-links";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  return createPageMetadata(locale, t("app.tagline"));
}

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const entries = await getRuntimeCatalogEntries();
  const catalogStats = getCatalogStats(entries);

  return (
    <div className="studio-home">
      <header className="studio-welcome"><Link href={`/${locale}`}>{t("app.name")} <span>/ your daily escape</span></Link><Link href={`/${locale}/watch`}>Watch a game <ArrowUpRight size={15} /></Link></header>
      <section className="studio-hero" aria-label="AllChess intro">
        <div className="intro-copy">
          <span className="studio-eyebrow">One place. Every kind of player.</span>
          <h1>Your board.<br /><em>Your next move.</em></h1>
          <p>A familiar favorite or a whole new game. Take a seat.</p>
          <div className="intro-actions">
            <Link href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never} className="focus-ring action-primary inline-flex items-center gap-2 px-5 py-3">
              <Swords size={18} />
              Quick match
            </Link>
            <Link href={playSetupHref(locale, { mode: "bot", time: "rapid" }) as never} className="focus-ring action-secondary inline-flex items-center gap-2 px-5 py-3">
              <Bot size={18} />
              Play a bot
            </Link>
          </div>
          <div className="intro-proof" aria-label="Intro stats">
            <span>{catalogStats.playableGames} playable games</span>
            <span>No account needed for local play</span>
          </div>
        </div>

        <IntroBoard />
      </section>

      <GameLibrary entries={entries} locale={locale} />
    </div>
  );
}
