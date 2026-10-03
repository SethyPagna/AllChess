import Link from "next/link";
import { Swords, Trophy } from "lucide-react";

import { EmptyNote } from "@/components/community/empty-note";
import { PopulatedLeaderboards } from "@/components/leaderboards/leaderboard-cards";
import { LeaderboardScopeMenu } from "@/components/leaderboards/leaderboard-scope-menu";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getRuntimeLeaderboards } from "@/lib/leaderboards/runtime";
import { createPageMetadata } from "@/lib/metadata/page-metadata";
import { playSetupHref } from "@/lib/routing/play-links";

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
  const populated = leaderboards.filter((leaderboard) => leaderboard.entries.length > 0);
  const showScopes = totalLeaderboards > 0 || filters.scope !== "all";

  return (
    <section className="cm-page">
      <header className="cm-head">
        <h1>Leaderboards</h1>
        {showScopes ? (
          <div className="cm-head-actions">
            <LeaderboardScopeMenu current={filters.scope} locale={locale} scopes={scopes.map(({ id, label }) => ({ id, label }))} />
          </div>
        ) : null}
      </header>
      {populated.length ? (
        <PopulatedLeaderboards leaderboards={populated} scopes={scopes} />
      ) : (
        <EmptyNote icon={Trophy} title="No rated results yet" text="Rankings appear after rated games are recorded.">
          <Link href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never} className="action-primary focus-ring">
            <Swords size={16} />
            Play online
          </Link>
        </EmptyNote>
      )}
    </section>
  );
}
