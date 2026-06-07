import { InfoHint } from "@/components/ui/info-hint";
import { createPageMetadata } from "@/lib/metadata/page-metadata";
import { WatchRoomPanel } from "@/components/watch/watch-room-panel";
import { WatchStats } from "@/components/watch/watch-stats";
import { normalizeLocale } from "@/lib/i18n/locales";
import { getRuntimeLiveStats, getRuntimeRoomList, normalizeRoomListInput } from "@/lib/realtime/runtime";
import { getGameCatalogEntry } from "@/lib/catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: rawLocale } = await params;
  const locale = normalizeLocale(rawLocale);
  return createPageMetadata(locale, "Watch rooms", "Spectate public games when live room activity exists.");
}

export default async function WatchPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ q?: string; status?: string; sort?: string; variant?: string }>;
}) {
  const { locale: rawLocale } = await params;
  const query = (await searchParams) ?? {};
  const locale = normalizeLocale(rawLocale);
  const requestedFilters = normalizeRoomListInput({
    query: query.q,
    sort: query.sort === "spectators" ? "spectators" : "recent",
    status: query.status === "active" || query.status === "waiting" ? query.status : "all",
    limit: 12
  });
  const [stats, roomList] = await Promise.all([getRuntimeLiveStats(), getRuntimeRoomList(requestedFilters)]);
  const hasRooms = stats.activeRooms > 0;
  const requestedVariant = query.variant && getGameCatalogEntry(query.variant) ? query.variant : undefined;

  return (
    <section className="watch-page grid gap-5">
      <div className="compact-page-heading">
        <h1 className="text-4xl font-black sm:text-5xl">Watch rooms</h1>
        <InfoHint text="Public games appear here only when live room activity exists. No filler matches, seeded players, or guessed counts." />
      </div>
      <WatchStats stats={stats} />
      <WatchRoomPanel hasRooms={hasRooms} locale={locale} requestedVariant={requestedVariant} roomList={roomList} />
    </section>
  );
}
