import React, { useState, useRef, useEffect } from "react";

export default function InputArea({
  onSend,
  disabled,
  isStreaming,
  selectedTabsCount,
  onTabsClick,
  tabsOpen,
  onWorkspaceClick,
  workspaceOpen,
  workspaceName,
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [value]);

  const handleSubmit = () => {
    const trimmed = value.trim();
    if (trimmed) {
      onSend(trimmed);
      setValue("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div id="input-area">
      <div id="tab-context-bar">
        <button
          id="btn-tabs"
          title="Add tab context"
          className={tabsOpen ? "active" : ""}
          onClick={onTabsClick}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M1 3h14v2H1V3zm0 4h14v2H1V7zm0 4h10v2H1v-2z" />
          </svg>
          <span id="tab-count">
            {selectedTabsCount} tab{selectedTabsCount !== 1 ? "s" : ""}{" "}
            selected
          </span>
        </button>
        <button
          id="btn-workspace"
          title={workspaceName ? "Change workspace directory" : "Set workspace directory"}
          className={workspaceOpen ? "active" : ""}
          onClick={onWorkspaceClick}
        >
          <span>{workspaceName ? "Change workspace" : "Set workspace"}</span>
        </button>
      </div>
      <div id="input-row">
        <textarea
          id="prompt-input"
          ref={textareaRef}
          placeholder="Ask OpenCode..."
          rows={1}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
        />
        <button
          id="btn-send"
          disabled={disabled || !value.trim() || isStreaming}
          onClick={handleSubmit}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M2 2l12 6-12 6V9l7-1-7-1V2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
