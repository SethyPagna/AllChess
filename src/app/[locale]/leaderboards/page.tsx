import { EmptyLeaderboardScopes, LeaderboardActions, LeaderboardFamilyList, LeaderboardFilterBar, PopulatedLeaderboards } from "@/components/leaderboards/leaderboard-cards";
import { InfoHint } from "@/components/ui/info-hint";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getRuntimeLeaderboards } from "@/lib/leaderboards/runtime";

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
      <LeaderboardFilterBar filters={filters} hasComputedBoards={hasComputedBoards} hasRatedResults={hasRatedResults} populatedCount={populatedLeaderboards.length} scopes={scopes} />
      {hasRatedResults ? <PopulatedLeaderboards leaderboards={populatedLeaderboards} /> : <EmptyLeaderboardScopes scopes={primaryScopes} />}
      <LeaderboardFamilyList scopes={familyScopes} />
      <LeaderboardActions locale={locale} />
    </section>
  );
}
