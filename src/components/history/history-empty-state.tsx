import Link from "next/link";
import { BarChart3, History, Play } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { playSetupHref } from "@/lib/routing/play-links";

type HistoryEmptyStateProps = {
  hasSavedRows: boolean;
  locale: string;
};

export function HistoryEmptyState({ hasSavedRows, locale }: HistoryEmptyStateProps) {
  return (
    <EmptyState className="panel" icon={History} title={hasSavedRows ? "No matching games" : "No saved matches yet"} help={hasSavedRows ? "Try a different search or result filter." : "Saved games, review links, and rating changes appear here after recorded account matches. Local saves are in the game library."}>
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
    </EmptyState>
  );
}
