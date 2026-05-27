import { Eye, Radio, Swords } from "lucide-react";

import type { LiveStats } from "@/lib/realtime/types";

type WatchStatsProps = {
  stats: LiveStats;
};

export function WatchStats({ stats }: WatchStatsProps) {
  return (
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
  );
}
