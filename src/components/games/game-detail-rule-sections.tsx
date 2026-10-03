import type { GameCatalogEntry } from "@/lib/catalog";

export function GameDetailRuleSections({ entry }: { entry: GameCatalogEntry }) {
  return (
    <>
      <details open className="game-section">
        <summary className="focus-ring">Basic rules</summary>
        <ol className="game-rules">
          {entry.shortRules.map((rule) => (
            <li key={rule}>{rule}</li>
          ))}
        </ol>
      </details>
      <details className="game-section">
        <summary className="focus-ring">How it ends</summary>
        <ul>
          {entry.winConditions.map((condition) => (
            <li key={condition}>{condition}</li>
          ))}
        </ul>
      </details>
    </>
  );
}
