import Link from "next/link";
import { BarChart3, Bot, Clock, Eye, Library, Lock, Radio, Swords, Trophy, Users } from "lucide-react";

import { InfoHint } from "@/components/info-hint";
import { displayGameName, gameFamilies, getCatalogStats, getGameCatalog } from "@/lib/catalog";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createDefaultStats } from "@/lib/stats";

export default async function LobbyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const catalog = getGameCatalog();
  const stats = getCatalogStats(catalog);
  const featured = catalog.filter((entry) => entry.playability === "playable").slice(0, 6);
  const familyHighlights = gameFamilies.slice(0, 6);
  const siteStats = createDefaultStats();
  const lobbyActions = [
    { Icon: Swords, title: t("lobby.quickPair"), body: "Find an even opponent by rating and preferred time control." },
    { Icon: Lock, title: t("lobby.privateRoom"), body: "Create a shareable room code for friends." },
    { Icon: Clock, title: t("lobby.correspondence"), body: "Play long-form games across time zones." },
    { Icon: Eye, title: "Watch live", body: "Spectate public rooms with read-only board, clocks, and move list." },
    { Icon: Bot, title: t("lobby.aiPractice"), body: "Practice against Easy through Legend bot levels." },
    { Icon: Users, title: "Live presence", body: `${siteStats.playersOnline.value} online / ${siteStats.activeRooms.value} rooms / ${siteStats.spectators.value} spectators.` }
  ];

  return (
    <section className="lobby-dashboard">
      <div className="space-y-5">
        <div className="compact-page-heading">
          <h1 className="text-4xl font-black sm:text-5xl">{t("lobby.title")}</h1>
          <InfoHint text={t("app.description")} />
        </div>
        <div className="panel lobby-action-row">
          <Link href={`/${locale}/play` as never} className="focus-ring action-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
            <Swords size={16} />
            Play now
          </Link>
          <Link href={`/${locale}/play/classic?bot=normal&mode=bot`} className="focus-ring action-secondary inline-flex items-center gap-2 px-4 py-2 text-sm">
            <Bot size={16} />
            Bot practice
          </Link>
          <Link href={`/${locale}/lobby?watch=live`} className="focus-ring action-secondary inline-flex items-center gap-2 px-4 py-2 text-sm">
            <Eye size={16} />
            Watch live
          </Link>
          <Link href={`/${locale}/variants`} className="focus-ring action-secondary inline-flex items-center gap-2 px-4 py-2 text-sm">
            <Library size={16} />
            Catalog
          </Link>
          <Link href={`/${locale}/leaderboards` as never} className="focus-ring action-secondary inline-flex items-center gap-2 px-4 py-2 text-sm">
            <Trophy size={16} />
            Leaderboards
          </Link>
        </div>
        <div className="lobby-stat-grid">
          <div className="panel lobby-stat-card">
            <BarChart3 size={18} />
            <strong>{stats.totalGames}</strong>
            <span>cataloged games</span>
          </div>
          <div className="panel lobby-stat-card">
            <Swords size={18} />
            <strong>{stats.playableGames}</strong>
            <span>playable now</span>
          </div>
          <div className="panel lobby-stat-card">
            <Radio size={18} />
            <strong>{stats.learnGames + stats.comingSoonGames}</strong>
            <span>learning paths</span>
          </div>
        </div>
        <div className="compact-section-heading">
          <h2 className="section-title">Play Now</h2>
          <InfoHint text="Playable boards, grouped tightly so the lobby reads at a glance." />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {featured.map((entry) => (
            <Link key={entry.id} href={`/${locale}/play/${entry.variantKey}`} className="panel focus-ring grid gap-2 p-4 transition hover:border-[var(--accent)]">
              <span className="flex items-center justify-between gap-3 text-lg font-black">
                {displayGameName(entry)}
                <span className="rounded-md bg-[var(--surface-soft)] px-2 py-1 text-xs font-bold text-[var(--muted)]">{entry.rulesAdapter}</span>
              </span>
              <span className="text-sm text-[var(--muted)]">{entry.winConditions[0]}</span>
            </Link>
          ))}
        </div>
        <div className="compact-section-heading">
          <h2 className="section-title">Game Families</h2>
          <InfoHint text="Explore the wider catalog by lineage and rules family." />
        </div>
        <div className="panel lobby-family-strip">
          {familyHighlights.map((family) => (
            <Link key={family.key} href={`/${locale}/variants?family=${family.key}`} className="focus-ring">
              <strong>{family.label}</strong>
              <span>{stats.familyCounts[family.key]} games</span>
            </Link>
          ))}
        </div>
      </div>
      <aside className="panel grid content-start gap-4 p-5">
        <div className="compact-section-heading">
          <h2 className="section-title">Lobby Tools</h2>
          <InfoHint text="Rooms, live watching, bot practice, and presence." />
        </div>
        {lobbyActions.map(({ Icon, title, body }) => (
          <div key={title} className="lobby-tool-row rounded-md bg-[var(--surface-strong)] p-3">
            <h2 className="flex items-center gap-2 font-bold">
              <Icon size={16} className="text-[var(--accent)]" />
              {title}
              <InfoHint text={body} />
            </h2>
          </div>
        ))}
      </aside>
    </section>
  );
}
