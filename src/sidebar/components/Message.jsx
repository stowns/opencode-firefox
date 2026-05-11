import React, { useState } from "react";
import DOMPurify from "dompurify";

function linkify(text) {
  return text.replace(
    /(?<!\]\()https?:\/\/[^\s<]+|(?<!\]\()(?<![\w\/])[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+(?:\/[^\s<]*)?/g,
    (match) => {
      if (match.startsWith("http")) return match;
      return `[${match}](https://${match})`;
    }
  );
}

export default function Message({ msg, marked, developerMode }) {
  const [showContext, setShowContext] = useState(false);
  const info = msg.info || msg;
  const isUser = info.role === "user";
  const parts = msg.parts || info.parts || [];

  if (msg.error) {
    return (
      <div className="message assistant">
        <div className="message-header">
          <span className="message-avatar">!</span>
        </div>
        <div className="message-content" style={{ color: "var(--error)" }}>
          {parts.find((p) => p.type === "text")?.text || "Error"}
        </div>
      </div>
    );
  }

  const renderMarkdown = (text) => {
    const rawHtml = marked.parse(linkify(text || ""));
    return { __html: DOMPurify.sanitize(rawHtml) };
  };

  return (
    <div className={`message ${isUser ? "user" : "assistant"}`}>
      <div className="message-header">
        <span className="message-avatar">{isUser ? "You" : "OpenCode"}</span>
        {!isUser && info.modelID && (
          <span className="message-model">{info.modelID}</span>
        )}
      </div>
      <div className="message-content">
        {isUser ? (
          <>
            <div className="message-text">
              {parts.find((p) => p.type === "text")?.text || ""}
            </div>
            <div className={`message-context-wrapper ${developerMode ? "" : "hidden"}`}>
              <button
                className="message-context-btn"
                onClick={() => setShowContext(!showContext)}
              >
                {showContext ? "Hide Context" : "View Context"}
              </button>
            </div>
            {showContext && msg.context && (
              <pre className="message-context">{msg.context}</pre>
            )}
          </>
        ) : (
          <>
            <div
              dangerouslySetInnerHTML={renderMarkdown(parts.find((p) => p.type === "text")?.text || "")}
            />
            <CopyButton
              text={parts.find((p) => p.type === "text")?.text || ""}
            />
          </>
        )}
      </div>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button className="message-copy-btn" onClick={handleCopy}>
      {copied ? "Copied!" : "Copy"}
    </button>
  );
}
