import { displayBotReadiness, displayPiecePresentation, type GameCatalogEntry } from "@/lib/catalog";
import type { VariantRuleCompletion } from "@/lib/variants/rules-atlas";

type GameDetailRuleSectionsProps = {
  completion: VariantRuleCompletion | null;
  entry: GameCatalogEntry;
};

export function GameDetailRuleSections({ completion, entry }: GameDetailRuleSectionsProps) {
  return (
    <>
      <article className="panel game-detail-section">
        <h2>Basic rules</h2>
        <ol className="game-detail-rule-list game-detail-rule-list-numbered">
          {entry.shortRules.map((rule, index) => (
            <li key={rule}>
              <strong>{index + 1}</strong>
              <span>{rule}</span>
            </li>
          ))}
        </ol>
      </article>
      <article className="panel game-detail-section">
        <h2>How it ends</h2>
        <ul className="game-detail-rule-list game-detail-rule-list-plain">
          {entry.winConditions.map((condition) => (
            <li key={condition}>{condition}</li>
          ))}
        </ul>
      </article>
      <article className="panel game-detail-section">
        <h2>Training focus</h2>
        <div className="game-detail-note">
          <span>{displayPiecePresentation(entry)}</span>
          <span>{displayBotReadiness(entry)}</span>
        </div>
        <ul className="game-detail-rule-list game-detail-rule-list-plain">
          {entry.reviewFocus.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </article>
      {completion ? (
        <article className="panel game-detail-section">
          <h2>{completion.status === "verified-playable" ? "Verified rules" : "Rules gate"}</h2>
          <ul className="game-detail-rule-list game-detail-rule-list-plain">
            {(completion.status === "verified-playable" ? completion.verifiedEdgeCases : completion.remainingGates).slice(0, 4).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      ) : null}
    </>
  );
}
