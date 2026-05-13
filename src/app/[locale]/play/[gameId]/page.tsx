import { notFound } from "next/navigation";
import { Bell, ChevronDown, Diamond, Eye, Flag, GraduationCap, Handshake, Mail, Puzzle, Radio, Search, Settings, Share2, Swords, Users } from "lucide-react";

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

  const navItems = [
    { label: "Play", icon: Swords, href: `/${locale}/play/classic`, active: true },
    { label: "Puzzles", icon: Puzzle, href: `/${locale}/learn` },
    { label: "Learn", icon: GraduationCap, href: `/${locale}/learn` },
    { label: "More", icon: ChevronDown, href: `/${locale}/variants` }
  ];

  return (
    <section className="play-arena">
      <aside className="play-rail" aria-label="Play navigation">
        <a href={`/${locale}`} className="play-rail-brand focus-ring">
          <span className="play-rail-mark">A</span>
          <span>AllChess</span>
        </a>

        <nav className="play-rail-nav">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a key={item.label} href={item.href} className={`play-rail-link focus-ring ${item.active ? "is-active" : ""}`}>
                <Icon size={21} />
                <span>{item.label}</span>
              </a>
            );
          })}
          <a href={`/${locale}/profile`} className="play-rail-link play-rail-trial focus-ring">
            <Diamond size={21} />
            <span>Free Trial</span>
          </a>
        </nav>

        <div className="play-rail-bottom">
          <button type="button" className="play-rail-search focus-ring">
            <Search size={18} />
            <span>Search</span>
          </button>
          <a href={`/${locale}/profile`} className="play-rail-profile focus-ring">
            <span className="play-rail-avatar">P</span>
            <span>Player</span>
          </a>
          <div className="play-rail-icons">
            <button type="button" className="focus-ring" aria-label="Friends">
              <Users size={18} />
            </button>
            <button type="button" className="focus-ring" aria-label="Messages">
              <Mail size={18} />
            </button>
            <button type="button" className="focus-ring" aria-label="Notifications">
              <Bell size={18} />
            </button>
            <button type="button" className="focus-ring" aria-label="Settings">
              <Settings size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className="play-core grid gap-4">
        <div className="play-context flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black sm:text-4xl">{t(variant.nameKey)}</h1>
            <p className="text-sm font-semibold text-[var(--muted)] sm:text-base">{variant.objective}</p>
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

        <div className="play-room-strip flex flex-wrap items-center gap-2 rounded-md p-3 text-sm text-[var(--muted)]">
          <Users size={16} className="text-[var(--accent)]" />
          Realtime-ready room: authoritative moves, reconnect snapshots, spectators, clocks, and bot seats use the server room protocol.
        </div>

        <GameBoard variantKey={variant.key} />
        <RulesPanel summary={getVariantRuleSummary(variant.key)} compact />
      </div>
    </section>
  );
}
