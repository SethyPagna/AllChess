import Link from "next/link";
import { ChevronLeft } from "lucide-react";

type AnalysisCommandBarProps = {
  gameId: string;
  locale: string;
  statusLabel: string;
};

export function AnalysisCommandBar({ gameId, locale, statusLabel }: AnalysisCommandBarProps) {
  return (
    <div className="panel analysis-command-bar">
      <span>Game {gameId}</span>
      <span>{statusLabel}</span>
      <Link href={`/${locale}/profile/player`} className="action-secondary focus-ring inline-flex items-center gap-2 px-3 py-2 text-sm">
        <ChevronLeft size={16} />
        Records
      </Link>
    </div>
  );
}
