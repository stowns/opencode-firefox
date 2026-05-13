interface HeaderProps {
  status: string;
  statusText: string;
  onSettingsClick: () => void;
  onClearSession: () => void;
  developerMode?: boolean;
}

export default function Header({ status, statusText, onSettingsClick, onClearSession, developerMode }: HeaderProps) {
  return (
    <header id="header">
      <div id="connection-status">
        <span id="status-dot" className={status}></span>
        <span id="status-text">{statusText}</span>
      </div>
      <div id="header-actions">
        {developerMode && (
          <button
            id="btn-clear-session"
            title="Clear session messages"
            onClick={onClearSession}
          >
            Clear Session
          </button>
        )}
        <button id="btn-settings" title="Settings" onClick={onSettingsClick}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="currentColor"
          >
            <path d="M8 10.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
            <path d="M14.5 7.5l-1.5-.2a5.5 5.5 0 00-.6-1.4l.9-1.2-1.4-1.4-1.2.9a5.5 5.5 0 00-1.4-.6L9 1.5h-2l-.2 1.5a5.5 5.5 0 00-1.4.6l-1.2-.9-1.4 1.4.9 1.2a5.5 5.5 0 00-.6 1.4L1.5 7.5v2l1.5.2a5.5 5.5 0 00.6 1.4l-.9 1.2 1.4 1.4 1.2-.9a5.5 5.5 0 001.4.6l.2 1.5h2l.2-1.5a5.5 5.5 0 001.4-.6l1.2.9 1.4-1.4-.9-1.2a5.5 5.5 0 00.6-1.4l1.5-.2v-2z" />
          </svg>
        </button>
      </div>
    </header>
  );
}
