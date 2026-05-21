import Link from "next/link";
import { History } from "lucide-react";

import { InfoHint } from "@/components/ui/info-hint";
import type { RuntimeProfileHistory } from "@/lib/profile/runtime";

type ProfileResultsProps = {
  history: RuntimeProfileHistory;
  locale: string;
};

export function ProfileResults({ history, locale }: ProfileResultsProps) {
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
