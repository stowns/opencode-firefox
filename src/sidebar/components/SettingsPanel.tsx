import { useState, useEffect } from "react";

interface ServerConfig {
  url: string;
  username: string;
  password: string;
}

interface SettingsPanelProps {
  open: boolean;
  serverConfig: ServerConfig;
  workspaceHistorySize: number;
  developerMode: boolean;
  onSave: (config: Partial<ServerConfig> & { workspaceHistorySize?: number; developerMode?: boolean }) => void;
}

export default function SettingsPanel({ open, serverConfig, workspaceHistorySize, developerMode, onSave }: SettingsPanelProps) {
  const [url, setUrl] = useState(serverConfig.url);
  const [username, setUsername] = useState(serverConfig.username);
  const [password, setPassword] = useState(serverConfig.password);
  const [historySize, setHistorySize] = useState(workspaceHistorySize);
  const [devMode, setDevMode] = useState(developerMode);

  useEffect(() => {
    if (open) {
      setUrl(serverConfig.url);
      setUsername(serverConfig.username);
      setPassword(serverConfig.password);
      setHistorySize(workspaceHistorySize);
      setDevMode(developerMode);
    }
  }, [open, serverConfig, workspaceHistorySize, developerMode]);

  if (!open) return null;

  const handleSave = () => {
    onSave({
      url: url.trim() || "http://localhost:4096",
      username: username.trim() || "opencode",
      password,
      workspaceHistorySize: Math.max(0, Math.min(50, parseInt(historySize) || 0)),
      developerMode: devMode,
    });
  };

  return (
    <div id="settings-panel" className="panel">
      <div className="panel-header">
        <span>Settings</span>
      </div>
      <div id="settings-content">
        <div className="setting-row setting-row-toggle">
          <label htmlFor="setting-dev-mode">Developer Mode</label>
          <input
            type="checkbox"
            id="setting-dev-mode"
            checked={devMode}
            onChange={(e) => setDevMode(e.target.checked)}
          />
        </div>
        <div className="setting-row">
          <label htmlFor="setting-history-size">Workspace history size</label>
          <input
            type="number"
            id="setting-history-size"
            min="0"
            max="50"
            value={historySize}
            onChange={(e) => setHistorySize(e.target.value)}
          />
        </div>
        <div className="setting-row">
          <label htmlFor="setting-password">Server Password</label>
          <input
            type="password"
            id="setting-password"
            placeholder="OPENCODE_SERVER_PASSWORD"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="setting-row">
          <label htmlFor="setting-username">Server Username</label>
          <input
            type="text"
            id="setting-username"
            placeholder="opencode"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="setting-row">
          <label htmlFor="setting-url">Server URL</label>
          <input
            type="text"
            id="setting-url"
            placeholder="http://localhost:4096"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <button id="btn-save-settings" className="btn-primary" onClick={handleSave}>
          Save
        </button>
      </div>
    </div>
  );
}
