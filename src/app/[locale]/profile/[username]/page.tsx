import Link from "next/link";
import { BarChart3, History, Play, Settings } from "lucide-react";

import { createTranslator } from "@/lib/i18n/dictionary";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function ProfilePage({
  params
}: {
  params: Promise<{ locale: string; username: string }>;
}) {
  const { locale: rawLocale, username } = await params;
  const locale = normalizeLocale(rawLocale);
  const t = createTranslator(locale);
  const displayName = username === "player" ? "Guest player" : username;

  return (
    <section className="account-page mx-auto grid max-w-5xl gap-5">
      <div className="panel account-profile-hero">
        <div className="grid h-20 w-20 place-items-center rounded-lg bg-[var(--accent)] text-2xl font-black text-black" aria-hidden="true">
          {displayName.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <h1 className="truncate text-4xl font-black">@{displayName}</h1>
          <p className="text-[var(--muted)]">Ratings and records sync here after signed-in games are saved.</p>
        </div>
        <Link href={`/${locale}/settings`} className="action-secondary focus-ring inline-flex items-center gap-2 px-4 py-2">
          <Settings size={16} />
          Settings
        </Link>
      </div>
      <div className="account-stat-grid">
        {[
          { label: t("chess.rating"), value: "Unrated", Icon: BarChart3 },
          { label: "Saved games", value: "0", Icon: History },
          { label: "Best game", value: "Pending", Icon: Play }
        ].map(({ Icon, label, value }) => (
          <div key={label} className="panel account-stat-card">
            <Icon size={18} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <div className="panel account-empty-state">
        <History size={26} />
        <h2>No profile history yet</h2>
        <p>AllChess will show real per-game ratings, recent matches, favorite variants, and review highlights once this profile has saved games in Cloudflare D1.</p>
        <div className="watch-actions">
          <Link href={`/${locale}/play`} className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2">
            <Play size={16} />
            Start playing
          </Link>
          <Link href={`/${locale}/history`} className="action-secondary focus-ring inline-flex items-center gap-2 px-4 py-2">
            <History size={16} />
            Match records
          </Link>
        </div>
      </div>
    </section>
  );
}
