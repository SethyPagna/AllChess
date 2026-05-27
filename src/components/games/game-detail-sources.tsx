import { ExternalLink } from "lucide-react";

import { InfoHint } from "@/components/ui/info-hint";
import type { GameCatalogEntry } from "@/lib/catalog";

type GameDetailSourcesProps = {
  sources: GameCatalogEntry["ruleSourceLinks"];
};

export function GameDetailSources({ sources }: GameDetailSourcesProps) {
  return (
    <article className="panel game-detail-section">
      <div className="game-detail-source-head">
        <h2>Sources</h2>
        <InfoHint text="Rule guides stay linked here so playable games can be checked against credible references." />
      </div>
      <ul>
        {sources.slice(0, 3).map((source) => (
          <li key={source.url}>
            <a className="focus-ring inline-flex items-center gap-2" href={source.url} rel="noreferrer" target="_blank">
              {source.name}
              <ExternalLink size={14} />
            </a>
          </li>
        ))}
      </ul>
      {sources.length > 3 ? <p className="game-detail-source-more">+{sources.length - 3} more references kept in the catalog record.</p> : null}
    </article>
  );
}
