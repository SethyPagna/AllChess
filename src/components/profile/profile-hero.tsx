import Link from "next/link";
import { Settings } from "lucide-react";

import { InfoHint } from "@/components/ui/info-hint";
import type { RuntimeProfileHistory } from "@/lib/profile/runtime";
import type { ProfileHistorySummary } from "@/lib/profile/summary";

type ProfileHeroProps = {
  displayName: string;
  history: RuntimeProfileHistory;
  locale: string;
  summary: ProfileHistorySummary;
};

export function ProfileHero({ displayName, history, locale, summary }: ProfileHeroProps) {
  return (
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
  );
}
