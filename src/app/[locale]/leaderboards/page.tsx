import Link from "next/link";
import { Filter, Play, Trophy } from "lucide-react";

import { InfoHint } from "@/components/info-hint";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getRuntimeLeaderboards, type RuntimeLeaderboards } from "@/lib/leaderboards/runtime";
import { playSetupHref } from "@/lib/routing/play-links";

export const dynamic = "force-dynamic";

export default async function LeaderboardsPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ scope?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const query = await searchParams;
  const locale = normalizeLocale(rawLocale);
  const { leaderboards, scopes, source, filters, totalLeaderboards } = await getRuntimeLeaderboards({ scope: query?.scope });
  const populatedLeaderboards = leaderboards.filter((leaderboard) => leaderboard.entries.length > 0);
  const hasComputedBoards = totalLeaderboards > 0;
  const hasRatedResults = populatedLeaderboards.length > 0;
  const primaryScopes = scopes.slice(0, 4);
  const familyScopes = scopes.slice(4);

  return (
    <section className="leaderboards-page grid gap-5">
      <div className="compact-page-heading">
        <h1 className="text-4xl font-black sm:text-5xl">Leaderboards</h1>
        <InfoHint text={source === "d1" ? "Leaderboards read Cloudflare D1 rows. Empty boards mean no rated entries have been computed yet." : "Rated tables stay empty until real match results are recorded. No seeded players or guessed rankings."} />
      </div>
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
          {hasRatedResults ? `${populatedLeaderboards.length} computed boards` : "Real results"}
        </span>
        <button type="submit" className="focus-ring record-filter-chip">Apply</button>
      </form>
      {hasRatedResults ? <PopulatedLeaderboards leaderboards={populatedLeaderboards} /> : <EmptyLeaderboardScopes scopes={primaryScopes} />}
      <div className="panel leaderboard-family-list">
        <h2>Game-family boards</h2>
        <div>
          {familyScopes.map((scope) => (
            <article key={scope.id}>
              <strong>{scope.label}</strong>
              <span>Waiting for rated games</span>
            </article>
          ))}
        </div>
      </div>
      <div className="watch-actions">
        <Link href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never} className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2">
          <Play size={16} />
          Play rated
        </Link>
        <Link href={`/${locale}/lobby`} className="action-secondary focus-ring inline-flex w-fit items-center gap-2 px-4 py-2">
          Back to lobby
        </Link>
      </div>
    </section>
  );
}

function EmptyLeaderboardScopes({ scopes }: { scopes: RuntimeLeaderboards["scopes"] }) {
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

function PopulatedLeaderboards({ leaderboards }: { leaderboards: RuntimeLeaderboards["leaderboards"] }) {
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
