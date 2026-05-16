import Link from "next/link";
import { Bot, Eye, Library, LogIn, Play, Swords } from "lucide-react";

import { getCatalogStats, getGameCatalog } from "@/lib/catalog";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const catalogStats = getCatalogStats(getGameCatalog());
  const workflows = [
    { Icon: Play, label: "Pick a board", detail: "Chess, variants, and rules in one place." },
    { Icon: Bot, label: "Train fast", detail: "Bots explain source, tier, and threat." },
    { Icon: Eye, label: "Watch or review", detail: "Rooms, history, and analysis stay connected." }
  ];

  return (
    <div className="intro-page">
      <section className="intro-hero" aria-label="AllChess intro">
        <div className="intro-copy">
          <h1>{t("app.name")}</h1>
          <p>Play first. Learn as you go. Sign in only when you want your games saved.</p>
          <div className="intro-actions">
            <Link href={`/${locale}/play`} className="focus-ring action-primary inline-flex items-center gap-2 px-5 py-3">
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
            <span>No fake live counts</span>
          </div>
        </div>

        <div className="intro-board-orbit" aria-hidden="true">
          <div className="intro-board">
            {Array.from({ length: 16 }, (_, index) => (
              <span key={index} />
            ))}
          </div>
          <div className="intro-orbit-piece is-king">K</div>
          <div className="intro-orbit-piece is-knight">N</div>
          <div className="intro-orbit-piece is-pawn">P</div>
        </div>
      </section>

      <section className="intro-workflow" aria-label="How AllChess works">
        {workflows.map(({ Icon, detail, label }) => (
          <article key={label} className="intro-workflow-step">
            <Icon size={18} />
            <strong>{label}</strong>
            <span>{detail}</span>
          </article>
        ))}
      </section>

      <nav className="intro-shortcuts" aria-label="Visitor shortcuts">
        <Link href={`/${locale}/practice`} className="focus-ring">
          <Bot size={16} />
          Bots
        </Link>
        <Link href={`/${locale}/variants`} className="focus-ring">
          <Library size={16} />
          Games & rules
        </Link>
        <Link href={`/${locale}/watch`} className="focus-ring">
          <Eye size={16} />
          Watch
        </Link>
      </nav>
    </div>
  );
}
