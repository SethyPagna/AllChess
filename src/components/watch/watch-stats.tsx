import type { LiveStats } from "@/lib/realtime/types";

/** A quiet "3 live · 12 watching" line beside the page title; hidden when nothing is live. */
export function WatchStats({ stats }: { stats: LiveStats }) {
  if (stats.activeGames === 0 && stats.spectators === 0) return null;

  return (
    <span className="cm-head-meta">
      {stats.activeGames} live · {stats.spectators} watching
    </span>
  );
}
