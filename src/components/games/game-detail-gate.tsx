import { Info } from "lucide-react";

export function GameDetailGate({ previewAvailable = false }: { previewAvailable?: boolean }) {
  return (
    <p className="game-note">
      <Info size={15} aria-hidden="true" />
      {previewAvailable ? "Local play is available. Online play is not ready." : "Explore the rules. Play is not available yet."}
    </p>
  );
}
