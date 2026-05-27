import { BarChart3, History, Play } from "lucide-react";

import type { ProfileHistorySummary } from "@/lib/profile/summary";

type ProfileStatsProps = {
  ratingLabel: string;
  summary: ProfileHistorySummary;
};

export function ProfileStats({ ratingLabel, summary }: ProfileStatsProps) {
  const stats = [
    { label: ratingLabel, value: summary.bestRating ? String(Math.round(summary.bestRating)) : "Unrated", Icon: BarChart3 },
    { label: "Saved games", value: String(summary.gamesPlayed), Icon: History },
    { label: "Best game", value: summary.recentResult ?? "Pending", Icon: Play }
  ];

  return (
    <div className="account-stat-grid">
      {stats.map(({ Icon, label, value }) => (
        <div key={label} className="panel account-stat-card">
          <Icon size={18} />
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}
