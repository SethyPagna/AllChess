import { Trophy } from "lucide-react";

import type { RuntimeLeaderboards } from "@/lib/leaderboards/runtime";

type EmptyLeaderboardScopesProps = {
  scopes: RuntimeLeaderboards["scopes"];
};

type PopulatedLeaderboardsProps = {
  leaderboards: RuntimeLeaderboards["leaderboards"];
};

export function EmptyLeaderboardScopes({ scopes }: EmptyLeaderboardScopesProps) {
  return (
    <div className="leaderboard-feature-grid">
      {scopes.map((scope) => (
        <article key={scope.id} className="panel leaderboard-card">
          <Trophy size={24} />
          <h2>{scope.label}</h2>
          <p>No rated results yet.</p>
        </article>
      ))}
    </div>
  );
}

export function PopulatedLeaderboards({ leaderboards }: PopulatedLeaderboardsProps) {
  return (
    <div className="leaderboard-feature-grid">
      {leaderboards.slice(0, 4).map((leaderboard) => (
        <article key={leaderboard.id} className="panel leaderboard-card">
          <Trophy size={24} />
          <h2>{leaderboard.id.replace(/-/g, " ")}</h2>
          <ol className="leaderboard-entry-list">
            {leaderboard.entries.slice(0, 5).map((entry) => (
              <li key={`${leaderboard.id}-${entry.rank}-${entry.displayName}`}>
                <strong>#{entry.rank}</strong>
                <span>{entry.displayName}</span>
                <span>{entry.rating ? Math.round(entry.rating) : "Unrated"}</span>
              </li>
            ))}
          </ol>
        </article>
      ))}
    </div>
  );
}
