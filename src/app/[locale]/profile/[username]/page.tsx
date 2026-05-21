import Link from "next/link";
import { BarChart3, History, Play, Settings } from "lucide-react";

import { ProfileEmptyState } from "@/components/profile/profile-empty-state";
import { ProfileResults } from "@/components/profile/profile-results";
import { InfoHint } from "@/components/ui/info-hint";
import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getRuntimeProfileHistory } from "@/lib/profile/runtime";
import { summarizeProfileHistory } from "@/lib/profile/summary";

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
