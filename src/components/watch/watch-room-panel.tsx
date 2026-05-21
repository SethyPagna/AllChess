import Link from "next/link";
import { Radio, Search, Swords, Trophy, Users } from "lucide-react";

import type { RuntimeRoomList } from "@/lib/realtime/runtime";
import { playSetupHref } from "@/lib/routing/play-links";
import { watchHref } from "@/lib/routing/watch-links";

type WatchRoomPanelProps = {
  hasRooms: boolean;
  locale: string;
  roomList: RuntimeRoomList;
};

export function WatchRoomPanel({ hasRooms, locale, roomList }: WatchRoomPanelProps) {
  const { query: searchQuery, sort: roomSort, status: statusFilter } = roomList.filters;
  const hasVisibleRooms = roomList.rooms.length > 0;

  return (
    <div className="panel watch-empty-state">
      {hasVisibleRooms ? (
        <>
          <h2>Live room list</h2>
          <p>Public rooms from Cloudflare D1. Search by room, game, status, or rated state.</p>
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
          <h2>{hasRooms ? "No rooms match those filters" : "No public rooms right now"}</h2>
          <p>{hasRooms ? "Clear the search or switch back to all rooms." : "Start a room or check back when a public game is live."}</p>
        </>
      )}
      <form className="watch-room-tools" aria-label="Watch room controls" action={`/${locale}/watch`}>
        <label className="watch-room-search">
          <Search size={15} />
          <input name="q" defaultValue={searchQuery} placeholder="Room, game, rated" aria-label="Search rooms" />
        </label>
        <select name="status" defaultValue={statusFilter} aria-label="Room status">
          <option value="all">All rooms</option>
          <option value="active">Live only</option>
          <option value="waiting">Waiting</option>
        </select>
        <button type="submit" className="focus-ring">
          <Search size={15} />
          Search
        </button>
        <Link href={watchHref(locale, { q: searchQuery, status: "all", sort: roomSort }) as never} className={`focus-ring watch-filter-chip${statusFilter === "all" ? " is-active" : ""}`} aria-current={statusFilter === "all" ? true : undefined}>
          <Radio size={15} />
          All
        </Link>
        <Link href={watchHref(locale, { q: searchQuery, status: "active", sort: roomSort }) as never} className={`focus-ring watch-filter-chip${statusFilter === "active" ? " is-active" : ""}`} aria-current={statusFilter === "active" ? true : undefined}>
          <Radio size={15} />
          Live
        </Link>
        <Link href={watchHref(locale, { q: searchQuery, status: statusFilter, sort: "spectators" }) as never} className={`focus-ring watch-filter-chip${roomSort === "spectators" ? " is-active" : ""}`} aria-current={roomSort === "spectators" ? true : undefined}>
          <Users size={15} />
          Spectators
        </Link>
      </form>
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
  );
}
