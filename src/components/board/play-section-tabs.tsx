import { panelTabOptions, type PanelTab } from "@/components/board/game-board-options";

type PlaySectionTabsProps = {
  activeTab: PanelTab;
  onChange: (tab: PanelTab) => void;
};

export function PlaySectionTabs({ activeTab, onChange }: PlaySectionTabsProps) {
  return (
    <div className="play-section-tabs" aria-label="Game tool sections" role="tablist">
      {panelTabOptions.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          title={`Show ${label} tools`}
          onClick={() => onChange(key)}
          className={`focus-ring ${activeTab === key ? "is-active" : ""}`}
          data-panel-tab={key}
          aria-selected={activeTab === key}
          role="tab"
        >
          <Icon size={15} />
          <span>{label}</span>
        </button>
      ))}
    </div>
  );
}
