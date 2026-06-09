import { Eye, Radio, Swords } from "lucide-react";

import type { LiveStats } from "@/lib/realtime/types";

type WatchStatsProps = {
  stats: LiveStats;
};

export function WatchStats({ stats }: WatchStatsProps) {
  return (
    <div className="lobby-stat-grid">
      <div className="panel lobby-stat-card" role="group" aria-label={`${stats.activeGames} active games`}>
        <Radio size={18} aria-hidden="true" />
        <strong>{stats.activeGames}</strong>
        <span>active games</span>
      </div>
      <div className="panel lobby-stat-card" role="group" aria-label={`${stats.spectators} spectators`}>
        <Eye size={18} aria-hidden="true" />
        <strong>{stats.spectators}</strong>
        <span>spectators</span>
      </div>
      <div className="panel lobby-stat-card" role="group" aria-label={`${stats.activeRooms} rooms`}>
        <Swords size={18} aria-hidden="true" />
        <strong>{stats.activeRooms}</strong>
        <span>rooms</span>
      </div>
    </div>
  );
}
