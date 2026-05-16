interface Tab {
  id: number;
  title?: string;
  url?: string;
  active?: boolean;
}

interface TabContextPanelProps {
  open: boolean;
  tabs: Tab[];
  selectedTabs: Set<number>;
  activeTabId: number | null;
  onToggleTab: (tabId: number, checked: boolean) => void;
  onRefresh: () => void;
  onDeselectAll: () => void;
}

export default function TabContextPanel({
  open,
  tabs,
  selectedTabs,
  activeTabId,
  onToggleTab,
  onRefresh,
  onDeselectAll,
}: TabContextPanelProps) {
  if (!open) return null;

  return (
    <div id="tab-context-panel" className="panel">
      <div className="panel-header">
        <span>Tab Context</span>
        <div className="panel-header-actions">
          <button className="btn-primary" onClick={onDeselectAll} disabled={selectedTabs.size === 0}>Deselect All</button>
          <button className="btn-primary" onClick={onRefresh}>Refresh</button>
        </div>
      </div>
      <div id="tabs-list">
        {tabs.map((tab) => (
          <div className={`tab-item${tab.id === activeTabId ? " active-tab" : ""}`} key={tab.id}>
            <input
              type="checkbox"
              id={`tab-${tab.id}`}
              checked={selectedTabs.has(tab.id)}
              onChange={(e) => onToggleTab(tab.id, e.target.checked)}
            />
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: "2px" }}>
              <label htmlFor={`tab-${tab.id}`}>
                {tab.title || "Untitled"}
                {tab.id === activeTabId && <span className="active-tab-badge">Active</span>}
              </label>
              <span className="tab-url">{tab.url || ""}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
