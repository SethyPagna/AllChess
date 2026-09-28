import { Fragment } from "react";
import { ArrowUpRight } from "lucide-react";

import type { GameCatalogEntry } from "@/lib/catalog";

export function GameDetailSources({ sources }: { sources: GameCatalogEntry["ruleSourceLinks"] }) {
  if (!sources.length) return null;

  return (
    <p className="game-sources-line">
      Sources:{" "}
      {sources.map((source, index) => (
        <Fragment key={source.url}>
          {index ? ", " : null}
          <a className="focus-ring" href={source.url} rel="noreferrer" target="_blank">
            {source.name}
            <ArrowUpRight size={13} aria-hidden="true" />
          </a>
        </Fragment>
      ))}
    </p>
  );
}
