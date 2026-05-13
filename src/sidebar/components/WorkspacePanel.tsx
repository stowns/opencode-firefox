import { useState, useEffect, useRef } from "react";

interface WorkspacePanelProps {
  open: boolean;
  workspacePath: string;
  onSet: (path: string) => void;
  onClose: () => void;
  recentWorkspaces: string[];
  onRemoveRecent: (path: string) => void;
}

export default function WorkspacePanel({ open, workspacePath, onSet, onClose, recentWorkspaces, onRemoveRecent }: WorkspacePanelProps) {
  const [input, setInput] = useState(workspacePath);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setInput(workspacePath);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, workspacePath]);

  if (!open) return null;

  const handleSet = () => {
    const trimmed = input.trim();
    onSet(trimmed);
    onClose();
  };

  const handleClear = () => {
    onSet("");
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSet();
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const handleRecentClick = (path: string) => {
    onSet(path);
    onClose();
  };

  const handleRemoveRecent = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    onRemoveRecent(path);
  };

  const displayRecent = (recentWorkspaces || []).filter((p) => p !== workspacePath);

  return (
    <div id="workspace-panel" className="panel">
      <div className="panel-header">
        <span>Workspace</span>
      </div>
      <div id="workspace-input-row">
        <input
          ref={inputRef}
          type="text"
          id="workspace-path-input"
          placeholder="~/projects/my-app"
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          autoComplete="off"
        />
        <button id="btn-workspace-set" onClick={handleSet}>
          Set
        </button>
      </div>
      {workspacePath && (
        <button id="btn-workspace-clear" onClick={handleClear}>
          Clear workspace
        </button>
      )}
      {displayRecent.length > 0 && (
        <div id="workspace-recent-list">
          <div className="recent-header">Recent</div>
          {displayRecent.map((path) => (
            <div className="recent-item" key={path} onClick={() => handleRecentClick(path)}>
              <span className="recent-path">{path}</span>
              <button className="recent-remove" onClick={(e) => handleRemoveRecent(e, path)}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
