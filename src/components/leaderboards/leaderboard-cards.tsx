import Link from "next/link";
import { Filter, Play, Trophy } from "lucide-react";

import type { RuntimeLeaderboards } from "@/lib/leaderboards/runtime";
import { playSetupHref } from "@/lib/routing/play-links";

type EmptyLeaderboardScopesProps = {
  scopes: RuntimeLeaderboards["scopes"];
};

type LeaderboardActionsProps = {
  locale: string;
};

type LeaderboardFamilyListProps = {
  scopes: RuntimeLeaderboards["scopes"];
};

type LeaderboardFilterBarProps = {
  filters: RuntimeLeaderboards["filters"];
  hasComputedBoards: boolean;
  hasRatedResults: boolean;
  populatedCount: number;
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

export function LeaderboardFilterBar({
  filters,
  hasComputedBoards,
  hasRatedResults,
  populatedCount,
  scopes
}: LeaderboardFilterBarProps) {
  return (
    <form className={`panel leaderboard-filter-bar ${hasComputedBoards ? "" : "is-empty"}`} aria-label="Leaderboard filters">
      <label className="leaderboard-scope-select" title="Choose a leaderboard scope. Empty scopes stay visible until rated games create rows.">
        <Filter size={16} />
        <span className="sr-only">Scope</span>
        <select name="scope" aria-label="Leaderboard scope" defaultValue={filters.scope}>
          <option value="all">All scopes</option>
          {scopes.map((scope) => (
            <option key={scope.id} value={scope.id}>{scope.label}</option>
          ))}
        </select>
      </label>
      <span aria-disabled="true" title="Only real rated games appear here.">Rated only</span>
      <span aria-disabled={hasRatedResults ? undefined : "true"} title={hasRatedResults ? "Showing computed Cloudflare D1 leaderboard rows." : "Leaderboards stay empty until real games are recorded."}>
        {hasRatedResults ? `${populatedCount} computed boards` : "Real results"}
      </span>
      <button type="submit" className="focus-ring record-filter-chip">Apply</button>
    </form>
  );
}

export function LeaderboardFamilyList({ scopes }: LeaderboardFamilyListProps) {
  return (
    <div className="panel leaderboard-family-list">
      <h2>Game-family boards</h2>
      <div>
        {scopes.map((scope) => (
          <article key={scope.id}>
            <strong>{scope.label}</strong>
            <span>Waiting for rated games</span>
          </article>
        ))}
      </div>
    </div>
  );
}

export function LeaderboardActions({ locale }: LeaderboardActionsProps) {
  return (
    <div className="watch-actions">
      <Link href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never} className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2">
        <Play size={16} />
        Play rated
      </Link>
      <Link href={`/${locale}/lobby`} className="action-secondary focus-ring inline-flex w-fit items-center gap-2 px-4 py-2">
        Back to lobby
      </Link>
    </div>
  );
}
