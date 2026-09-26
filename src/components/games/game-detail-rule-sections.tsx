import { displayBotReadiness, displayPiecePresentation, type GameCatalogEntry } from "@/lib/catalog";
import type { VariantRuleCompletion } from "@/lib/variants/rules-atlas";

type GameDetailRuleSectionsProps = {
  completion: VariantRuleCompletion | null;
  entry: GameCatalogEntry;
};

export function GameDetailRuleSections({ completion, entry }: GameDetailRuleSectionsProps) {
  return (
    <>
      <details open className="panel game-detail-section studio-disclosure">
        <summary>Basic rules</summary>
        <ol className="game-detail-rule-list game-detail-rule-list-numbered">
          {entry.shortRules.map((rule, index) => (
            <li key={rule}>
              <strong>{index + 1}</strong>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      </details>
      <details className="panel game-detail-section studio-disclosure">
        <summary>How it ends</summary>
        <ul className="game-detail-rule-list game-detail-rule-list-plain">
          {entry.winConditions.map((condition) => (
            <li key={condition}>{condition}</li>
          ))}
        </ul>
      </details>
      <details className="panel game-detail-section studio-disclosure">
        <summary>Training focus</summary>
        <div className="game-detail-note">
          <span>{displayPiecePresentation(entry)}</span>
          <span>{displayBotReadiness(entry)}</span>
        </div>
        <ul className="game-detail-rule-list game-detail-rule-list-plain">
          {entry.reviewFocus.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </details>
      {completion ? (
        <details open={completion.status !== "verified-playable"} className="panel game-detail-section studio-disclosure">
          <summary>{completion.status === "verified-playable" ? "Verified rules" : "Rules gate"}</summary>
          <ul className="game-detail-rule-list game-detail-rule-list-plain">
            {(completion.status === "verified-playable" ? completion.verifiedEdgeCases : completion.remainingGates).slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </>
  );
}
