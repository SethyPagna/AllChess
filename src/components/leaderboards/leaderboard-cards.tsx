import Link from "next/link";
import { Play, Trophy } from "lucide-react";

import { EmptyState } from "@/components/ui/empty-state";
import { FormChoicePicker } from "@/components/ui/form-choice-picker";
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
  locale: string;
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
    <EmptyState className="panel" icon={Trophy} title="No rated results yet." help="Rankings appear after rated games are recorded.">
      {scopes.length === 1 ? <span className="studio-empty-caption">{scopes[0].label}</span> : null}
    </EmptyState>
  );
}

export function PopulatedLeaderboards({ leaderboards }: PopulatedLeaderboardsProps) {
  return (
    <div className="leaderboard-feature-grid">
      {leaderboards.slice(0, 4).map((leaderboard) => (
        <article key={leaderboard.id} className="panel leaderboard-card" role="group" aria-label={`${leaderboard.id.replace(/-/g, " ")} leaderboard with ${leaderboard.entries.length} rated entries.`}>
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
    <form method="get" className={`panel leaderboard-filter-bar ${hasComputedBoards ? "" : "is-empty"}`} aria-label="Leaderboard filters">
      <div title="Choose a leaderboard scope."><FormChoicePicker key={filters.scope} name="scope" label="Leaderboard scope" defaultValue={filters.scope} options={[{ key: "all", label: "All scopes" }, ...scopes.map(scope => ({ key: scope.id, label: scope.label }))]} /></div>
      <button type="submit" className="leaderboard-filter-submit focus-ring">
        Filter
      </button>
      <span className="leaderboard-filter-stat" aria-disabled="true" title="Only real rated games appear here.">Rated only</span>
      <span className="leaderboard-filter-stat" aria-disabled={hasRatedResults ? undefined : "true"} title={hasRatedResults ? "Rankings from recorded rated games." : "Leaderboards stay empty until real games are recorded."}>
        {hasRatedResults ? `${populatedCount} rankings` : "Real results"}
      </span>
    </form>
  );
}

export function LeaderboardFamilyList({ scopes, locale }: LeaderboardFamilyListProps) {
  return (
    <details className="panel leaderboard-family-list studio-disclosure">
      <summary>All rankings</summary>
      <div>
        {scopes.map((scope) => (
          <Link className="focus-ring" key={scope.id} href={`/${locale}/leaderboards?scope=${encodeURIComponent(scope.id)}` as never}>{scope.label}</Link>
        ))}
      </div>
    </details>
  );
}

export function LeaderboardActions({ locale }: LeaderboardActionsProps) {
  return (
    <div className="watch-actions">
      <Link href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never} className="action-primary focus-ring watch-action-button">
        <Play size={16} />
        Play
      </Link>
      <Link href={`/${locale}/lobby`} className="action-secondary focus-ring watch-action-button">
        Back to lobby
      </Link>
    </div>
  );
}
