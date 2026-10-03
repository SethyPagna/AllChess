import type { ProfileHistorySummary } from "@/lib/profile/summary";

type ProfileStatsProps = {
  ratingLabel: string;
  summary: ProfileHistorySummary;
};

export function ProfileStats({ ratingLabel, summary }: ProfileStatsProps) {
  const stats = [
    { label: ratingLabel, value: summary.bestRating ? String(Math.round(summary.bestRating)) : "Unrated" },
    { label: "Games", value: String(summary.gamesPlayed) },
    { label: "Last result", value: summary.recentResult ?? "—" }
  ];

  return (
    <dl className="profile-stats">
      {stats.map(({ label, value }) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
