import Link from "next/link";
import { Eye, Radio, Swords, Trophy } from "lucide-react";

import { InfoHint } from "@/components/info-hint";
import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createDemoLiveStats } from "@/lib/realtime/rooms";

export default async function WatchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const env = await getCloudflareRuntimeEnv();
  const stats = env.ALLCHESS_D1 ? await createD1GameRepository(env.ALLCHESS_D1).getLiveStats() : createDemoLiveStats();
  const hasLiveRooms = stats.activeRooms > 0 || stats.activeGames > 0 || stats.spectators > 0;

  return (
    <section className="watch-page grid gap-5">
      <div className="compact-page-heading">
        <h1 className="text-4xl font-black sm:text-5xl">Watch rooms</h1>
        <InfoHint text="Public games appear here only when live room activity exists. No filler matches, seeded players, or guessed counts." />
      </div>
      <div className="lobby-stat-grid">
        <div className="panel lobby-stat-card">
          <Radio size={18} />
          <strong>{stats.activeGames}</strong>
          <span>active games</span>
        </div>
        <div className="panel lobby-stat-card">
          <Eye size={18} />
          <strong>{stats.spectators}</strong>
          <span>spectators</span>
        </div>
        <div className="panel lobby-stat-card">
          <Swords size={18} />
          <strong>{stats.activeRooms}</strong>
          <span>rooms</span>
        </div>
      </div>
      <div className="panel watch-empty-state">
        {hasLiveRooms ? (
          <>
            <h2>Live room list is syncing</h2>
            <p>Room presence is active. Public room snapshots will appear as games publish visibility.</p>
          </>
        ) : (
          <>
            <h2>No public rooms right now</h2>
            <p>Start a room or check back when a public game is live.</p>
          </>
        )}
        <div className="watch-actions">
          <Link href={`/${locale}/play`} className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2">
            <Swords size={16} />
            Start playing
          </Link>
          <Link href={`/${locale}/leaderboards`} className="action-secondary focus-ring inline-flex items-center gap-2 px-4 py-2">
            <Trophy size={16} />
            Leaderboards
          </Link>
        </div>
      </div>
    </section>
  );
}
