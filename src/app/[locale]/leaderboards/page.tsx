import { EmptyLeaderboardScopes, LeaderboardActions, LeaderboardFamilyList, LeaderboardFilterBar, PopulatedLeaderboards } from "@/components/leaderboards/leaderboard-cards";
import { InfoHint } from "@/components/ui/info-hint";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getRuntimeLeaderboards } from "@/lib/leaderboards/runtime";
import { createPageMetadata } from "@/lib/metadata/page-metadata";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  return createPageMetadata(locale, "Leaderboards", "Rated tables from real AllChess match results.");
}

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
  const { leaderboards, scopes, filters, totalLeaderboards } = await getRuntimeLeaderboards({ scope: query?.scope });
  const populatedLeaderboards = leaderboards.filter((leaderboard) => leaderboard.entries.length > 0);
  const hasComputedBoards = totalLeaderboards > 0;
  const hasRatedResults = populatedLeaderboards.length > 0;
  const selectedScope = filters.scope === "all" ? null : scopes.find((scope) => scope.id === filters.scope);
  const emptyScopes = selectedScope ? [selectedScope] : scopes.slice(0, 4);
  const familyScopes = selectedScope ? [] : scopes;

  return (
    <section className="leaderboards-page grid gap-5">
      <div className="compact-page-heading">
        <h1 className="text-4xl font-black sm:text-5xl">Leaderboards</h1>
        <InfoHint text="Rankings from recorded rated games. Choose a scope to see a game or family." />
      </div>
      <LeaderboardFilterBar filters={filters} hasComputedBoards={hasComputedBoards} hasRatedResults={hasRatedResults} populatedCount={populatedLeaderboards.length} scopes={scopes} />
      {hasRatedResults ? <PopulatedLeaderboards leaderboards={populatedLeaderboards} /> : <EmptyLeaderboardScopes scopes={emptyScopes} />}
      {familyScopes.length > 0 ? <LeaderboardFamilyList scopes={familyScopes} locale={locale} /> : null}
      <LeaderboardActions locale={locale} />
    </section>
  );
}
