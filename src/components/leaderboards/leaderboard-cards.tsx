import { getGameCatalogEntry } from "@/lib/catalog";
import type { RuntimeLeaderboards } from "@/lib/leaderboards/runtime";

type PopulatedLeaderboardsProps = {
  leaderboards: RuntimeLeaderboards["leaderboards"];
  scopes: RuntimeLeaderboards["scopes"];
};

export function PopulatedLeaderboards({ leaderboards, scopes }: PopulatedLeaderboardsProps) {
  return (
    <div className="lb-grid">
      {leaderboards.slice(0, 4).map((leaderboard) => {
        const title = (leaderboard.gameId ? getGameCatalogEntry(leaderboard.gameId)?.name.english : undefined)
          ?? scopes.find((scope) => scope.id === leaderboard.scopeId)?.label
          ?? leaderboard.id.replace(/-/g, " ");

        return (
          <article key={leaderboard.id} className="cm-card lb-card" aria-label={`${title} leaderboard with ${leaderboard.entries.length} rated entries.`}>
            <h2>{title}</h2>
            <ol>
              {leaderboard.entries.slice(0, 5).map((entry) => (
                <li key={`${leaderboard.id}-${entry.rank}-${entry.displayName}`}>
                  <span className="lb-rank">{entry.rank}</span>
                  <span className="lb-name">{entry.displayName}</span>
                  <span className="lb-rating">{entry.rating ? Math.round(entry.rating) : "Unrated"}</span>
                </li>
              ))}
            </ol>
          </article>
        );
      })}
    </div>
  );
}
