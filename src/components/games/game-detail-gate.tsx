import { InfoHint } from "@/components/ui/info-hint";

type GameDetailGateProps = { primaryGap?: string | null; previewAvailable?: boolean };

export function GameDetailGate({ primaryGap, previewAvailable = false }: GameDetailGateProps) {
  return (
    <div className="game-detail-gate panel" aria-label="Training and rules gate">
      <div>
        <strong>{previewAvailable ? "Preview" : "Guide only"}</strong>
        <span>{previewAvailable ? "Local play is available. Online play is not ready." : "Explore the rules. Play is not available yet."}</span>
      </div>
      <InfoHint text={primaryGap ?? "Rules and game behavior are still being verified."} />
    </div>
  );
}
