import React, { useState } from "react";

export default function SessionsPanel({
  open,
  sessions,
  activeSession,
  onSwitch,
  onCreate,
  onRename,
}) {
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState("");

  if (!open) return null;

  const startRename = (session) => {
    setEditingId(session.id);
    setEditValue(session.title || "Untitled");
  };

  const commitRename = (session) => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== session.title) {
      onRename(session, trimmed);
    }
    setEditingId(null);
    setEditValue("");
  };

  const handleKeyDown = (e, session) => {
    if (e.key === "Enter") {
      commitRename(session);
    } else if (e.key === "Escape") {
      setEditingId(null);
      setEditValue("");
    }
  };

  const sorted = [...sessions].sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)
  );

  return (
    <div id="sessions-panel" className="panel">
      <div className="panel-header">
        <span>Sessions</span>
        <button onClick={() => onCreate()}>+ New</button>
      </div>
      <div id="sessions-list">
        {sorted.length === 0 ? (
          <div
            style={{
              padding: "8px 12px",
              color: "var(--text-secondary)",
              fontSize: "12px",
            }}
          >
            No sessions
          </div>
        ) : (
          sorted.map((session) => {
            const isActive = activeSession?.id === session.id;
            const isEditing = editingId === session.id;
            return (
              <div
                className={`session-item ${isActive ? "active" : ""}`}
                key={session.id}
              >
                {isEditing ? (
                  <input
                    className="session-edit-input"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onBlur={() => commitRename(session)}
                    onKeyDown={(e) => handleKeyDown(e, session)}
                    autoFocus
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <div
                    className="session-title"
                    onClick={() => onSwitch(session)}
                    onDoubleClick={() => startRename(session)}
                    title={session.title || "Untitled"}
                  >
                    {session.title || "Untitled"}
                  </div>
                )}
                {isActive && !isEditing && (
                  <button
                    className="session-rename-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(session);
                    }}
                    title="Rename"
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 16 16"
                      fill="currentColor"
                    >
                      <path d="M11.5 1.5l3 3L5 14H2v-3L11.5 1.5z" />
                    </svg>
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
