import Link from "next/link";
import { BarChart3, History, Play } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { playSetupHref } from "@/lib/routing/play-links";

type ProfileEmptyStateProps = {
  locale: string;
};

export function ProfileEmptyState({ locale }: ProfileEmptyStateProps) {
  return (
    <EmptyState className="panel" icon={History} title="No profile history yet" help="Recorded account matches appear here. Games saved on this device are in the game library.">
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
    </EmptyState>
  );
}
