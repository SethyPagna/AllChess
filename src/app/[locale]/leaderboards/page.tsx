import Link from "next/link";
import { Filter, Play, Trophy } from "lucide-react";

import { InfoHint } from "@/components/info-hint";
import { getLeaderboardScopes } from "@/lib/catalog";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function LeaderboardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const scopes = getLeaderboardScopes();
  const primaryScopes = scopes.slice(0, 4);
  const familyScopes = scopes.slice(4);

  return (
    <section className="leaderboards-page grid gap-5">
      <div className="compact-page-heading">
        <h1 className="text-4xl font-black sm:text-5xl">Leaderboards</h1>
        <InfoHint text="Rated tables stay empty until real match results are recorded. No seeded players or guessed rankings." />
      </div>
      <div className="panel leaderboard-filter-bar is-empty" aria-label="Leaderboard filters">
        <span aria-disabled="true" title="Scope filters unlock when rated results exist.">
          <Filter size={16} />
          Scope
        </span>
        <span aria-disabled="true" title="Only real rated games appear here.">Rated only</span>
        <span aria-disabled="true" title="Leaderboards stay empty until real games are recorded.">Real results</span>
      </div>
      <div className="leaderboard-feature-grid">
        {primaryScopes.map((scope) => (
          <article key={scope.id} className="panel leaderboard-card">
            <Trophy size={24} />
            <h2>{scope.label}</h2>
            <p>No rated results yet.</p>
          </article>
        ))}
      </div>
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
        <Link href={`/${locale}/play`} className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2">
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
