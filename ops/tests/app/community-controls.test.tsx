import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, test } from "vitest";

import type { D1Database } from "@cloudflare/workers-types";

import { AnalysisReviewTools } from "@/components/analysis/analysis-review-tools";
import { WatchRoomPanel } from "@/components/watch/watch-room-panel";
import { createD1GameRepository } from "@/lib/cloudflare/d1";
import { normalizeRoomListInput, type RuntimeRoomList } from "@/lib/realtime/runtime";
import type { RoomSnapshot } from "@/lib/realtime/types";

const xiangqiRoom = {
  roomId: "room-7",
  gameId: "game-7",
  variantKey: "xiangqi",
  status: "active",
  players: [],
  spectators: 3,
  clocks: [],
  state: {},
  moveVersion: 12,
  rated: true,
  chatPolicy: "open"
} as unknown as RoomSnapshot;

function roomList(filters: Partial<RuntimeRoomList["filters"]> = {}, rooms: RoomSnapshot[] = [xiangqiRoom]): RuntimeRoomList {
  return { mode: "d1", rooms, filters: { limit: 12, query: "", sort: "recent", status: "all", ...filters } };
}

function renderWatch(filters: Partial<RuntimeRoomList["filters"]>, options: { rooms?: RoomSnapshot[]; variant?: string } = {}) {
  return renderToStaticMarkup(<WatchRoomPanel hasRooms locale="en" requestedVariant={options.variant} roomList={roomList(filters, options.rooms)} />);
}

describe("watch room controls", () => {
  test("search keeps the active status and sort, and the game filter is one removable chip", () => {
    const markup = renderWatch({ status: "active", sort: "spectators" }, { variant: "xiangqi" });

    expect(markup).toMatch(/name="status" value="active"/);
    expect(markup).toMatch(/name="sort" value="spectators"/);
    expect(markup).toMatch(/name="variant" value="xiangqi"/);
    expect(markup).toMatch(/class="cm-chip cm-chip-clear focus-ring"[^>]*href="\/en\/watch\?status=active&amp;sort=spectators">Xiangqi/);
    expect(markup).toContain(", clear game filter");
    expect(markup).toContain('href="/en/watch?variant=xiangqi&amp;sort=spectators"');
  });

  test("room rows are named by their visible text", () => {
    const markup = renderWatch({});

    expect(markup).not.toContain("Spectate xiangqi");
    expect(markup).toContain('<a class="cm-row focus-ring" href="/en/play/xiangqi?mode=spectate&amp;room=room-7">');
    expect(markup).toContain('<span class="sr-only"> watching</span>');
    expect(markup).toContain(">Live</span> · Rated · 12 plies");
  });

  test("the searched-room shortcut appears only for id-like queries", () => {
    for (const query of ["xiangqi", "Classic Chess", "rated", "live", "two words"]) {
      expect(renderWatch({ query }, { rooms: [] })).not.toContain("Open searched room");
    }

    const markup = renderWatch({ query: "abc123" }, { rooms: [] });
    expect(markup).toContain("Open searched room");
    expect(markup).toContain("/en/play/classic?mode=spectate&amp;room=abc123");
  });
});

describe("room list variant filter", () => {
  test("normalization keeps a trimmed variant and drops an empty one", () => {
    expect(normalizeRoomListInput({ variant: " xiangqi " }).variant).toBe("xiangqi");
    expect(normalizeRoomListInput({ variant: "  " }).variant).toBeUndefined();
  });

  test("listRooms narrows to one game when a variant is given", async () => {
    const calls: { sql: string; bindings: unknown[] }[] = [];
    const db = {
      prepare(sql: string) {
        return {
          bind(...bindings: unknown[]) {
            calls.push({ sql, bindings });
            return { all: async () => ({ results: [] }) };
          }
        };
      }
    } as unknown as D1Database;

    await createD1GameRepository(db).listRooms({ visibility: "public", variant: "xiangqi", limit: 5 });
    const list = calls.find((call) => call.sql.includes("from rooms r"));

    expect(list?.sql).toContain("r.variant_key = ?");
    expect(list?.bindings.slice(-2)).toEqual(["xiangqi", 5]);
  });
});

describe("analysis playback at the ends of a game", () => {
  const moves = Array.from({ length: 3 }, (_, index) => ({ gameId: "g", ply: index + 1, move: {}, notation: `Move ${index + 1}`, boardStateAfter: {}, createdAt: "2026-09-27T00:00:00Z" }));
  const render = (selectedMoveIndex: number) =>
    renderToStaticMarkup(<AnalysisReviewTools autoPlay={false} gameId="g" locale="en" moves={moves} reviewMomentByMove={new Map()} selectedMoveIndex={selectedMoveIndex} />);

  test("first move disables First and Previous instead of linking to the same ply", () => {
    const markup = render(0);

    expect(markup).toMatch(/<button type="button" class="icon-btn" disabled=""[^>]*aria-label="First"/);
    expect(markup).toMatch(/<button type="button" class="icon-btn" disabled=""[^>]*aria-label="Previous"/);
    expect(markup).toMatch(/<a href="\/en\/analysis\/g\?ply=2" class="icon-btn focus-ring" aria-label="Next"/);
  });

  test("last move disables Next and Last", () => {
    const markup = render(2);

    expect(markup).toMatch(/<button type="button" class="icon-btn" disabled=""[^>]*aria-label="Next"/);
    expect(markup).toMatch(/<button type="button" class="icon-btn" disabled=""[^>]*aria-label="Last"/);
    expect(markup).toMatch(/<a href="\/en\/analysis\/g\?ply=1" class="icon-btn focus-ring" aria-label="First"/);
  });
});
