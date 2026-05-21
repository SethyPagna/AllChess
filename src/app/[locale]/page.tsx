import Link from "next/link";
import { Bot, Eye, Library, LogIn, Play, Swords } from "lucide-react";

import { PieceIcon } from "@/components/board/piece-icon";
import { getCatalogStats } from "@/lib/catalog";
import { getRuntimeCatalogEntries } from "@/lib/catalog/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { playSetupHref } from "@/lib/routing/play-links";
import type { PlayerColor } from "@/lib/variants";

const introPieces: Record<number, { code: string; owner: PlayerColor }> = {
  0: { code: "r", owner: "black" },
  1: { code: "n", owner: "black" },
  2: { code: "b", owner: "black" },
  3: { code: "q", owner: "black" },
  4: { code: "k", owner: "black" },
  5: { code: "b", owner: "black" },
  6: { code: "n", owner: "black" },
  7: { code: "r", owner: "black" },
  8: { code: "p", owner: "black" },
  9: { code: "p", owner: "black" },
  10: { code: "p", owner: "black" },
  11: { code: "p", owner: "black" },
  12: { code: "p", owner: "black" },
  13: { code: "p", owner: "black" },
  14: { code: "p", owner: "black" },
  15: { code: "p", owner: "black" },
  48: { code: "p", owner: "white" },
  49: { code: "p", owner: "white" },
  50: { code: "p", owner: "white" },
  51: { code: "p", owner: "white" },
  52: { code: "p", owner: "white" },
  53: { code: "p", owner: "white" },
  54: { code: "p", owner: "white" },
  55: { code: "p", owner: "white" },
  56: { code: "r", owner: "white" },
  57: { code: "n", owner: "white" },
  58: { code: "b", owner: "white" },
  59: { code: "q", owner: "white" },
  60: { code: "k", owner: "white" },
  61: { code: "b", owner: "white" },
  62: { code: "n", owner: "white" },
  63: { code: "r", owner: "white" }
};

export const dynamic = "force-dynamic";

export default async function HomePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const catalogStats = getCatalogStats(await getRuntimeCatalogEntries());
  const workflows = [
    { Icon: Play, label: "Pick a board", detail: "Chess, variants, and rules in one place.", href: playSetupHref(locale, { mode: "online", time: "rapid" }) },
    { Icon: Bot, label: "Train fast", detail: "Bots explain source, tier, and threat.", href: playSetupHref(locale, { mode: "bot", time: "rapid" }) },
    { Icon: Eye, label: "Watch or review", detail: "Rooms, history, and analysis stay connected.", href: `/${locale}/watch` }
  ];

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

        <div className="intro-board-orbit" aria-label="Classic chess board preview" role="img">
          <div className="intro-board">
            {Array.from({ length: 64 }, (_, index) => {
              const piece = introPieces[index];
              const row = Math.floor(index / 8);
              const col = index % 8;
              const isLight = (row + col) % 2 === 0;

              return (
                <span key={index} className={isLight ? "is-light" : "is-dark"}>
                  {piece ? <PieceIcon code={piece.code} owner={piece.owner} variantKey="classic" /> : null}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      <section className="intro-workflow" aria-label="How AllChess works">
        {workflows.map(({ Icon, detail, href, label }) => (
          <Link key={label} href={href as never} className="focus-ring intro-workflow-step">
            <Icon size={18} />
            <strong>{label}</strong>
            <span>{detail}</span>
          </Link>
        ))}
      </section>

      <nav className="intro-shortcuts" aria-label="Visitor shortcuts">
        <Link href={playSetupHref(locale, { mode: "bot", time: "rapid" }) as never} className="focus-ring">
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
