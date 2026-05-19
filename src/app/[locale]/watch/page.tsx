import Link from "next/link";
import { Eye, Radio, Search, Swords, Trophy, Users } from "lucide-react";

import { InfoHint } from "@/components/info-hint";
import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { getCloudflareRuntimeEnv } from "@/lib/cloudflare/runtime";
import { normalizeLocale } from "@/lib/i18n/locales";
import { createDemoLiveStats } from "@/lib/realtime/rooms";
import { getRuntimeRoomList } from "@/lib/realtime/runtime";
import { playSetupHref } from "@/lib/routing/play-links";

export const dynamic = "force-dynamic";

export default async function WatchPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  const env = await getCloudflareRuntimeEnv();
  const [stats, roomList] = await Promise.all([env.ALLCHESS_D1 ? createD1GameRepository(env.ALLCHESS_D1).getLiveStats() : createDemoLiveStats(), getRuntimeRoomList(12)]);
  const hasRooms = roomList.rooms.length > 0;

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
        {hasRooms ? (
          <>
            <h2>Live room list</h2>
            <p>Public rooms from Cloudflare D1. Open one to spectate the latest saved state.</p>
            <div className="watch-room-list" aria-label="Public rooms">
              {roomList.rooms.map((room) => (
                <Link key={room.roomId} href={`/${locale}/play/${room.variantKey}?mode=spectate&room=${room.roomId}`} className="focus-ring watch-room-card">
                  <span>
                    <strong>{room.variantKey}</strong>
                    <small>{room.status} / {room.rated ? "rated" : "casual"}</small>
                  </span>
                  <span>
                    <strong>{room.moveVersion}</strong>
                    <small>plies</small>
                  </span>
                  <span>
                    <strong>{room.spectators}</strong>
                    <small>watching</small>
                  </span>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <>
            <h2>No public rooms right now</h2>
            <p>Start a room or check back when a public game is live.</p>
          </>
        )}
        <div className={`watch-room-tools ${hasRooms ? "" : "is-empty"}`} aria-label="Watch room controls">
          <button type="button" disabled={!hasRooms} title={hasRooms ? "Use the visible room list to choose a public room." : "Search unlocks when public rooms are available."}>
            <Search size={15} />
            Search rooms
          </button>
          <button type="button" disabled={!hasRooms} title={hasRooms ? "Spectator counts are shown on each public room." : "Spectator list unlocks after a live room is published."}>
            <Users size={15} />
            Spectators
          </button>
          <button type="button" disabled={!hasRooms} title={hasRooms ? "Showing public waiting and active rooms." : "Live filters stay disabled until real room data exists."}>
            <Radio size={15} />
            Live only
          </button>
        </div>
        <div className="watch-actions">
          <Link href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never} className="action-primary focus-ring inline-flex items-center gap-2 px-4 py-2">
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
