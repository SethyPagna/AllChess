import { displayModeReadiness, getCatalogModeSupport, type CatalogPlayMode, type GameCatalogEntry } from "@/lib/catalog";

export const catalogModeKeys = ["online", "bot", "offline", "room", "spectate"] as const satisfies readonly CatalogPlayMode[];

export const catalogModeLabels: Record<CatalogPlayMode, string> = {
  online: "Online",
  bot: "Bot",
  offline: "Local",
  room: "Room",
  spectate: "Watch"
};

export function CatalogModeGrid({ entry }: { entry: GameCatalogEntry }) {
  return (
    <div className="catalog-mode-grid">
      {catalogModeKeys.map((modeKey) => {
        const support = getCatalogModeSupport(entry, modeKey);
        return (
          <div key={modeKey} className="catalog-mode-row" data-enabled={support.enabled}>
            <strong>{catalogModeLabels[modeKey]}</strong>
            <span>{displayModeReadiness(entry, modeKey)}</span>
            <p>{support.reason}</p>
          </div>
        );
      })}
    </div>
  );
}
