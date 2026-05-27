import Link from "next/link";
import { BarChart3, History, Play } from "lucide-react";

import { InfoHint } from "@/components/ui/info-hint";
import { playSetupHref } from "@/lib/routing/play-links";

type HistoryEmptyStateProps = {
  hasSavedRows: boolean;
  locale: string;
};

export function HistoryEmptyState({ hasSavedRows, locale }: HistoryEmptyStateProps) {
  return (
    <div className="panel account-empty-state">
      <History size={24} />
      <h2>{hasSavedRows ? "No matching games" : "No saved matches yet"}</h2>
      <p>{hasSavedRows ? "Try a different search or result filter." : "Saved games, review links, and rating changes appear here after real matches."}</p>
      <InfoHint text={hasSavedRows ? "Search filters only the saved Cloudflare D1 match rows already available." : "History uses stored match data only. It stays empty until Cloudflare D1 has a real finished game for this account."} />
      <div className="watch-actions">
        <Link className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2" href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never}>
          <Play size={16} />
          Play
        </Link>
        <Link className="action-secondary focus-ring inline-flex items-center gap-2 px-4 py-2" href={`/${locale}/leaderboards`}>
          <BarChart3 size={16} />
          Ratings
        </Link>
      </div>
    </div>
  );
}
