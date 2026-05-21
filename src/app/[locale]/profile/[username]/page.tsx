import Link from "next/link";
import { BarChart3, History, Play, Settings } from "lucide-react";

import { InfoHint } from "@/components/ui/info-hint";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getRuntimeProfileHistory, type RuntimeProfileHistory } from "@/lib/profile/runtime";
import { summarizeProfileHistory } from "@/lib/profile/summary";
import { playSetupHref } from "@/lib/routing/play-links";

export const dynamic = "force-dynamic";

export default async function ProfilePage({
  params
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale: rawLocale, username } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const displayName = username === "player" ? "Guest player" : username;
  const history = await getRuntimeProfileHistory(username, 5);
  const summary = summarizeProfileHistory(history);

  return (
    <section className="account-page mx-auto grid max-w-5xl gap-5">
      <div className="panel account-profile-hero">
        <div className="grid h-20 w-20 place-items-center rounded-lg bg-[var(--accent)] text-2xl font-black text-black" aria-hidden="true">
          {displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-[var(--muted)]">Profile & history</p>
          <h1 className="truncate text-4xl font-black">@{displayName}</h1>
          <div className="account-profile-meta">
            <span>{history.source === "d1" ? "Cloudflare profile" : "Guest-ready"}</span>
            <span>{summary.bestRating ? `${Math.round(summary.bestRating)} peak` : "Unrated"}</span>
            <InfoHint text="Ratings, records, favorite games, and review highlights sync here after signed-in games are saved." />
          </div>
        </div>
        <Link href={`/${locale}/settings`} className="action-secondary focus-ring inline-flex items-center gap-2 px-4 py-2">
          <Settings size={16} />
          Settings
        </Link>
      </div>
      <div className="account-stat-grid">
        {[
          { label: t("chess.rating"), value: summary.bestRating ? String(Math.round(summary.bestRating)) : "Unrated", Icon: BarChart3 },
          { label: "Saved games", value: String(summary.gamesPlayed), Icon: History },
          { label: "Best game", value: summary.recentResult ?? "Pending", Icon: Play }
        ].map(({ Icon, label, value }) => (
          <div key={label} className="panel account-stat-card">
            <Icon size={18} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      {history.results.length > 0 ? <ProfileResults history={history} locale={locale} /> : <ProfileEmptyState locale={locale} />}
    </section>
  );
}

function ProfileEmptyState({ locale }: { locale: string }) {
  return (
    <div className="panel account-empty-state">
      <History size={26} />
      <h2>No profile history yet</h2>
      <p>Start a game to build recent matches, favorite games, and review highlights.</p>
      <InfoHint text="Profile history uses saved game data only, so this area stays empty until real matches are recorded." />
      <div className="watch-actions">
        <Link href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never} className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2">
          <Play size={16} />
          Start playing
        </Link>
        <Link href={`/${locale}/leaderboards`} className="action-secondary focus-ring inline-flex items-center gap-2 px-4 py-2">
          <BarChart3 size={16} />
          View ratings
        </Link>
        <Link href={`/${locale}/history`} className="action-secondary focus-ring inline-flex items-center gap-2 px-4 py-2">
          <History size={16} />
          Full history
        </Link>
      </div>
    </div>
  );
}

function ProfileResults({ history, locale }: { history: RuntimeProfileHistory; locale: string }) {
  return (
    <div className="panel profile-history-list">
      <div className="compact-section-heading">
        <h2 className="section-title">Recent matches</h2>
        <InfoHint text="These rows come from saved Cloudflare D1 match results for this profile." />
        <Link href={`/${locale}/history`} className="action-secondary focus-ring inline-flex items-center gap-2 px-3 py-2 text-sm">
          <History size={15} />
          Full history
        </Link>
      </div>
      <div>
        {history.results.map((result) => (
          <Link key={result.id} href={`/${locale}/analysis/${result.gameId}`} className="focus-ring profile-history-row">
            <span>{result.variantKey}</span>
            <strong>{result.result}</strong>
            <span>{result.outcomeReason ?? "recorded result"}</span>
            <span>{result.ratingDelta == null ? "unrated" : `${result.ratingDelta > 0 ? "+" : ""}${result.ratingDelta}`}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
