import React, { useEffect, useRef } from "react";
import Message from "./Message";
import PermissionPrompt from "./PermissionPrompt";
import QuestionPrompt from "./QuestionPrompt";

export default function MessagesList({ messages, marked, workingStatus, pendingPermission, respondToPermission, pendingQuestion, answerQuestion, abortSession, developerMode }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages, workingStatus, pendingPermission, pendingQuestion]);

  const visibleMessages = messages.filter((msg) => {
    const info = msg.info || msg;
    const parts = msg.parts || info.parts || [];
    const textPart = parts.find((p) => p.type === "text");
    if (msg.error) return true;
    if (info.role === "user") return true;
    if (info.role === "assistant") return textPart && textPart.text.trim().length > 0;
    return false;
  });

  if (visibleMessages.length === 0) {
    return (
      <div id="messages" ref={containerRef}>
        <div className="welcome">
          <h2>OpenCode</h2>
          <p>Ask me anything about the current page or selected tabs.</p>
        </div>
      </div>
    );
  }

  return (
    <div id="messages" ref={containerRef}>
      {visibleMessages.map((msg, i) => (
        <Message key={i} msg={msg} marked={marked} developerMode={developerMode} />
      ))}
      <PermissionPrompt permission={pendingPermission} onRespond={respondToPermission} />
      <QuestionPrompt question={pendingQuestion} onAnswer={answerQuestion} />
      {workingStatus && (
        <div id="working-indicator">
          <div className="working-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
          <span className="working-text">{workingStatus.text}</span>
          <button className="btn-cancel" onClick={abortSession} title="Cancel current task">
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
