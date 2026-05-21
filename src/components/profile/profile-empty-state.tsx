import Link from "next/link";
import { BarChart3, History, Play } from "lucide-react";

import { InfoHint } from "@/components/ui/info-hint";
import { playSetupHref } from "@/lib/routing/play-links";

type ProfileEmptyStateProps = {
  locale: string;
};

export function ProfileEmptyState({ locale }: ProfileEmptyStateProps) {
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
