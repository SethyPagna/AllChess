import Link from "next/link";
import { BarChart3, Bot, Eye, Library, Radio, Swords, Trophy } from "lucide-react";

import { LobbyActivity } from "@/components/lobby/lobby-activity";
import { InfoHint } from "@/components/ui/info-hint";
import { displayGameName, displayRulesReadiness, gameFamilies, getCatalogStats } from "@/lib/catalog";
import { getRuntimeCatalogEntries } from "@/lib/catalog/runtime";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getRuntimeLiveStats } from "@/lib/realtime/runtime";
import { playGameHref, playSetupHref } from "@/lib/routing/play-links";
import { createDefaultStats } from "@/lib/realtime/stats";

export const dynamic = "force-dynamic";

export default async function LobbyPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const [catalog, liveStats] = await Promise.all([getRuntimeCatalogEntries(), getRuntimeLiveStats()]);
  const stats = getCatalogStats(catalog);
  const featured = catalog.filter((entry) => entry.playability === "playable").slice(0, 6);
  const familyHighlights = gameFamilies.slice(0, 6);
  const siteStats = createDefaultStats(liveStats);

  return (
    <section className="lobby-dashboard">
      <div className="space-y-5">
        <div className="compact-page-heading">
          <h1 className="text-4xl font-black sm:text-5xl">{t("lobby.title")}</h1>
          <InfoHint text={t("app.description")} />
        </div>
        <div className="panel lobby-action-row">
          <Link href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never} className="focus-ring action-primary inline-flex items-center gap-2 px-4 py-2 text-sm">
            <Swords size={16} />
            Play now
          </Link>
          <Link href={playGameHref(locale, "classic", { mode: "bot", time: "rapid" }) as never} className="focus-ring action-secondary inline-flex items-center gap-2 px-4 py-2 text-sm">
            <Bot size={16} />
            Bot training
          </Link>
          <Link href={`/${locale}/watch` as never} className="focus-ring action-secondary inline-flex items-center gap-2 px-4 py-2 text-sm">
            <Eye size={16} />
            Watch rooms
          </Link>
          <Link href={`/${locale}/variants`} className="focus-ring action-secondary inline-flex items-center gap-2 px-4 py-2 text-sm">
            <Library size={16} />
            Games & rules
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
            <span>games & rules</span>
          </div>
          <div className="panel lobby-stat-card">
            <Swords size={18} />
            <strong>{stats.playableGames}</strong>
            <span>playable now</span>
          </div>
          <div className="panel lobby-stat-card">
            <Radio size={18} />
            <strong>{stats.learnGames + stats.comingSoonGames}</strong>
            <span>guides & drafts</span>
          </div>
        </div>
        <div className="compact-section-heading">
          <h2 className="section-title">Play Now</h2>
          <InfoHint text="Playable boards, grouped tightly so the lobby reads at a glance." />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {featured.map((entry) => (
            <Link key={entry.id} href={playGameHref(locale, entry.variantKey, { mode: "offline", time: "rapid" }) as never} className="panel focus-ring grid gap-2 p-4 transition hover:border-[var(--accent)]">
              <span className="flex items-center justify-between gap-3 text-lg font-black">
                {displayGameName(entry)}
                <span className="rounded-md bg-[var(--surface-soft)] px-2 py-1 text-xs font-bold text-[var(--muted)]">{displayRulesReadiness(entry)}</span>
              </span>
              <span className="text-sm text-[var(--muted)]">{entry.winConditions[0]}</span>
            </Link>
          ))}
        </div>
        <div className="compact-section-heading">
          <h2 className="section-title">Games & Rules</h2>
          <InfoHint text="Browse related games together, then open a short rule guide or a verified board." />
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
      <LobbyActivity locale={locale} siteStats={siteStats} t={t} />
    </section>
  );
}
