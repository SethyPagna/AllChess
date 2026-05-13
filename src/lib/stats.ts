export type SiteStat = {
  label: string;
  value: string;
  isEstimated: boolean;
};

import type { LiveStats } from "@/lib/realtime/types";
import { getCatalogStats } from "@/lib/catalog";

export function createDefaultStats(live: LiveStats = { playersOnline: 0, activeRooms: 0, activeGames: 0, spectators: 0, botGames: 0, source: "demo" }) {
  const catalog = live.catalog ?? getCatalogStats();
  return {
    playersOnline: {
      label: "Players online",
      value: String(live.playersOnline),
      isEstimated: false
    },
    activeRooms: {
      label: "Active rooms",
      value: String(live.activeRooms),
      isEstimated: false
    },
    spectators: {
      label: "Spectators",
      value: String(live.spectators),
      isEstimated: false
    },
    variants: {
      label: "Games cataloged",
      value: String(catalog.totalGames),
      isEstimated: false
    },
    review: {
      label: "Review",
      value: "D1-ready",
      isEstimated: false
    },
    bots: {
      label: "Bots",
      value: "GM + Legend",
      isEstimated: false
    }
  } satisfies Record<string, SiteStat>;
}
