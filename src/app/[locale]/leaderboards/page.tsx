import Link from "next/link";
import { Trophy } from "lucide-react";

import { getLeaderboardScopes } from "@/lib/catalog";
import { normalizeLocale } from "@/lib/i18n/locales";

export default async function LeaderboardsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const scopes = getLeaderboardScopes();

  return (
    <section className="grid gap-5">
      <div>
        <h1 className="text-4xl font-black sm:text-5xl">Leaderboards</h1>
        <p className="mt-2 text-[var(--muted)]">Rated tables appear after Cloudflare room results are recorded.</p>
      </div>
      <div className="catalog-grid">
        {scopes.map((scope) => (
          <article key={scope.id} className="panel leaderboard-card">
            <Trophy size={24} />
            <h2>{scope.label}</h2>
            <p>No rated results yet.</p>
          </article>
        ))}
      </div>
      <Link href={`/${locale}/lobby`} className="action-secondary focus-ring inline-flex w-fit items-center gap-2 px-4 py-2">
        Back to lobby
      </Link>
    </section>
  );
}
