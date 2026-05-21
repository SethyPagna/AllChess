import Link from "next/link";

import { InfoHint } from "@/components/ui/info-hint";
import type { RuntimeRecentHistory } from "@/lib/history/runtime";

type RecentHistoryListProps = {
  history: RuntimeRecentHistory;
  locale: string;
};

export function RecentHistoryList({ history, locale }: RecentHistoryListProps) {
  return (
    <div className="panel profile-history-list">
      <div className="compact-section-heading">
        <h2 className="section-title">Recent saved games</h2>
        <InfoHint text={history.source === "d1" ? "These rows are distinct saved games from Cloudflare D1." : "History stays empty until real saved games exist."} />
      </div>
      <div>
        {history.results.map((result) => (
          <Link key={result.id} href={`/${locale}/analysis/${result.gameId}`} className="focus-ring profile-history-row">
            <span>{result.variantKey}</span>
            <strong>{result.result}</strong>
            <span>{result.outcomeReason ?? result.mode}</span>
            <span>{result.movesPlayed} moves</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
