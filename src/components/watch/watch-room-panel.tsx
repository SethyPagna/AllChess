import Link from "next/link";
import { ArrowUpRight, Eye, Radio, Search, Swords, X } from "lucide-react";

import { EmptyNote } from "@/components/community/empty-note";
import type { RuntimeRoomList } from "@/lib/realtime/runtime";
import type { RoomStatus } from "@/lib/realtime/types";
import { getGameCatalog, getGameCatalogEntry } from "@/lib/catalog";
import { playSetupHref } from "@/lib/routing/play-links";
import { watchHref } from "@/lib/routing/watch-links";

type WatchRoomPanelProps = {
  hasRooms: boolean;
  locale: string;
  requestedVariant?: string;
  roomList: RuntimeRoomList;
};

const statusFilters = [
  { key: "all", label: "All" },
  { key: "active", label: "Live" },
  { key: "waiting", label: "Waiting" }
] as const;

const statusLabels: Record<RoomStatus, string> = { active: "Live", waiting: "Waiting", completed: "Finished", abandoned: "Abandoned" };

/** Words the room search matches on status or rating; they never name a single room. */
const filterWords = new Set(["all", "rated", "casual", "live", "waiting", "active", "finished", "completed", "abandoned", "popular"]);

export function WatchRoomPanel({ hasRooms, locale, requestedVariant, roomList }: WatchRoomPanelProps) {
  const { query: searchQuery, sort: roomSort, status: statusFilter } = roomList.filters;
  const showFilters = hasRooms || roomList.rooms.length > 0;
  const searchedRoom = createSearchedRoomShortcut(searchQuery, requestedVariant, roomList);
  const linkFor = (values: { status?: string; sort?: string }) => watchHref(locale, { q: searchQuery, variant: requestedVariant, status: statusFilter, sort: roomSort, ...values }) as never;
  const variantEntry = requestedVariant ? getGameCatalogEntry(requestedVariant) : undefined;
  const variantName = variantEntry?.name.short ?? variantEntry?.name.english ?? requestedVariant;

  return (
    <>
      <form className="cm-toolbar" aria-label="Watch room controls" action={`/${locale}/watch`}>
        <div className="cm-search">
          <button type="submit" className="focus-ring" aria-label="Search" title="Search"><Search size={15} /></button>
          <input type="search" name="q" defaultValue={searchQuery} placeholder={showFilters ? "Room, game, rated" : "Room ID"} aria-label="Search rooms" enterKeyHint="search" />
        </div>
        {requestedVariant ? <input type="hidden" name="variant" value={requestedVariant} /> : null}
        {statusFilter !== "all" ? <input type="hidden" name="status" value={statusFilter} /> : null}
        {roomSort !== "recent" ? <input type="hidden" name="sort" value={roomSort} /> : null}
        {showFilters ? (
          <div className="cm-chips" role="group" aria-label="Room filters">
            {requestedVariant ? (
              <Link href={watchHref(locale, { q: searchQuery, status: statusFilter, sort: roomSort }) as never} className="cm-chip cm-chip-clear focus-ring" title="Clear game filter">
                {variantName}
                <X size={14} aria-hidden="true" />
                <span className="sr-only">, clear game filter</span>
              </Link>
            ) : null}
            {statusFilters.map((filter) => (
              <Link key={filter.key} href={linkFor({ status: filter.key })} className="cm-chip focus-ring" aria-current={statusFilter === filter.key ? true : undefined}>
                {filter.label}
              </Link>
            ))}
            <Link href={linkFor({ sort: roomSort === "spectators" ? "recent" : "spectators" })} className="cm-chip cm-chip-toggle focus-ring" aria-current={roomSort === "spectators" ? true : undefined} title="Most watched first">
              Popular
            </Link>
          </div>
        ) : null}
      </form>

      {searchedRoom ? (
        <div className="cm-list">
          <Link href={spectateHref(locale, searchedRoom.variantKey, searchedRoom.roomId)} className="cm-row focus-ring">
            <span className="cm-row-main">
              <span className="cm-row-title">Open searched room</span>
              <span className="cm-row-sub">{searchedRoom.variantLabel} / {searchedRoom.roomId}</span>
            </span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      ) : null}

      {roomList.rooms.length ? (
        <div className="cm-list" aria-label="Public rooms">
          {roomList.rooms.map((room) => (
            <Link key={room.roomId} href={spectateHref(locale, room.variantKey, room.roomId)} className="cm-row focus-ring">
              <span className="cm-row-main">
                <span className="cm-row-title">{getGameCatalogEntry(room.variantKey)?.name.english ?? room.variantKey}</span>
                <span className="cm-row-sub">
                  <span className="watch-status" data-status={room.status}>{statusLabels[room.status] ?? room.status}</span> · {room.rated ? "Rated" : "Casual"} · {room.moveVersion} plies
                </span>
              </span>
              <span className="cm-row-end">
                <Eye size={14} aria-hidden="true" />
                {room.spectators}
                <span className="sr-only"> watching</span>
              </span>
            </Link>
          ))}
        </div>
      ) : hasRooms ? (
        <EmptyNote icon={Radio} title="No rooms match those filters" text="Try another search or show all rooms.">
          <Link href={watchHref(locale) as never} className="action-secondary focus-ring">Show all rooms</Link>
        </EmptyNote>
      ) : (
        <EmptyNote icon={Radio} title="No public rooms right now" text="Live public games show up here.">
          <Link href={playSetupHref(locale, { mode: "online", time: "rapid" }) as never} className="action-primary focus-ring">
            <Swords size={16} />
            Play online
          </Link>
        </EmptyNote>
      )}
    </>
  );
}

function spectateHref(locale: string, variantKey: string, roomId: string) {
  return `/${locale}/play/${variantKey}?mode=spectate&room=${encodeURIComponent(roomId)}` as never;
}

/** Offers a direct spectate link only for id-like queries, not for game names or filter words. */
function createSearchedRoomShortcut(searchQuery: string, requestedVariant: string | undefined, roomList: RuntimeRoomList) {
  const roomId = searchQuery.trim();
  if (!roomId || /\s/.test(roomId) || filterWords.has(roomId.toLowerCase())) return null;
  const exactRoom = roomList.rooms.find((room) => room.roomId === roomId || room.gameId === roomId);
  if (!exactRoom && getGameCatalogEntry(roomId)) return null;
  const variantKey = exactRoom?.variantKey ?? resolveWatchVariant(requestedVariant) ?? inferVariantFromRoomId(roomId) ?? "classic";
  const variant = getGameCatalogEntry(variantKey);
  return {
    roomId,
    variantKey,
    variantLabel: variant?.name.short ?? variant?.name.english ?? variantKey
  };
}

function resolveWatchVariant(value: string | undefined) {
  if (!value) return null;
  return getGameCatalogEntry(value)?.variantKey ?? null;
}

function inferVariantFromRoomId(roomId: string) {
  const normalized = roomId.toLowerCase();
  const localSuffix = "-local";
  if (!normalized.endsWith(localSuffix)) return null;
  const candidate = normalized.slice(0, -localSuffix.length);
  return getGameCatalog().some((entry) => entry.variantKey === candidate) ? candidate : null;
}
