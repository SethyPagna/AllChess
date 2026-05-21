type GameDetailGateProps = {
  primaryGap?: string | null;
};

export function GameDetailGate({ primaryGap }: GameDetailGateProps) {
  return (
    <div className="game-detail-gate panel" aria-label="Training and rules gate">
      <div>
        <strong>Guide gated for play</strong>
        <span>
          This game stays as a rule guide until native rules, legal bot moves, review, persistence, and E2E fixtures are complete.
        </span>
      </div>
      <span>{primaryGap ?? "Complete the verification matrix before enabling play."}</span>
    </div>
  );
}
