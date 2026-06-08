import {
  displayGameName,
  displayModeReadiness,
  getCatalogModeSupport,
  getCatalogSupportedModes,
  type CatalogModeSupport,
  type CatalogPlayMode,
  type GameCatalogEntry
} from "@/lib/catalog";

export const catalogModeKeys = ["online", "bot", "offline", "room", "spectate"] as const satisfies readonly CatalogPlayMode[];

export const catalogModeLabels: Record<CatalogPlayMode | "all", string> = {
  all: "All modes",
  online: "Online",
  bot: "Bot",
  offline: "Local",
  room: "Room",
  spectate: "Watch"
};

export function CatalogModeStrip({ entry }: { entry: GameCatalogEntry }) {
  const supportedModes = getCatalogSupportedModes(entry);
  const compactModes = supportedModes.length ? supportedModes : [getCatalogModeSupport(entry, "spectate")];

  return (
    <div className="catalog-mode-strip" aria-label={`${displayGameName(entry)} mode support`}>
      {compactModes.slice(0, 5).map((support) => (
        <CatalogModeChip key={support.mode} entry={entry} support={support} />
      ))}
    </div>
  );
}

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

function CatalogModeChip({ entry, support }: { entry: GameCatalogEntry; support: CatalogModeSupport }) {
  const modeLabel = catalogModeLabels[support.mode];
  const readiness = displayModeReadiness(entry, support.mode);
  const normalizedModeLabel = modeLabel.toLowerCase();
  const normalizedReadiness = readiness.toLowerCase();
  const readinessIncludesMode = normalizedReadiness === normalizedModeLabel || normalizedReadiness.startsWith(`${normalizedModeLabel} `);
  const primaryLabel = readinessIncludesMode ? readiness : modeLabel;
  const showReadiness = !readinessIncludesMode;

  return (
    <span className="catalog-mode-chip" data-level={support.level} title={support.reason}>
      {primaryLabel}
      {showReadiness ? <small>{readiness}</small> : null}
    </span>
  );
}
