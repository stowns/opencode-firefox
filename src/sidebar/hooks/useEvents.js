import { useState, useEffect, useRef, useCallback } from "react";

export function useEvents(baseUrl, getAuthHeader, activeSessionId) {
  const [workingStatus, setWorkingStatus] = useState(null);
  const [pendingPermission, setPendingPermission] = useState(null);
  const [pendingQuestion, setPendingQuestion] = useState(null);
  const abortRef = useRef(null);
  const baseUrlRef = useRef(baseUrl);
  const getAuthHeaderRef = useRef(getAuthHeader);
  const activeSessionIdRef = useRef(activeSessionId);

  useEffect(() => {
    baseUrlRef.current = baseUrl;
    getAuthHeaderRef.current = getAuthHeader;
    activeSessionIdRef.current = activeSessionId;
  }, [baseUrl, getAuthHeader, activeSessionId]);

  const connectSSE = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const readStream = async () => {
      try {
        const headers = { Accept: "text/event-stream" };
        const auth = getAuthHeaderRef.current();
        if (auth) headers.Authorization = auth;

        let buffer = "";

        const response = await fetch(`${baseUrlRef.current}/global/event`, {
          headers,
          signal: controller.signal,
        });

        if (!response.ok) return;

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const event = JSON.parse(line.slice(6));
                handleEvent(event);
              } catch {
                // skip malformed events
              }
            }
          }
        }
      } catch (e) {
        if (e.name !== "AbortError" && !controller.signal.aborted) {
          setTimeout(connectSSE, 3000);
        }
      }
    };

    const handleEvent = (event) => {
      const payload = event.payload;
      if (!payload) return;

      const type = payload.type;
      const props = payload.properties || {};

      const currentSessionId = activeSessionIdRef.current;
      if (!currentSessionId) return;

      const sessionId = props.sessionID;
      if (sessionId && sessionId !== currentSessionId) return;

      switch (type) {
        case "session.status": {
          const statusType = props.status?.type;
          if (statusType === "busy" || statusType === "retry") {
            setWorkingStatus({ type: "thinking", text: "Thinking..." });
          }
          break;
        }

        case "session.idle":
          setWorkingStatus(null);
          break;

        case "message.part.updated": {
          const part = props.part || {};
          if (part.type === "tool" && part.state === "running") {
            const toolName = part.name || "";
            const input = part.input || {};
            if (toolName === "bash" || toolName === "exec") {
              const cmd = input.command || "";
              setWorkingStatus({
                type: "running",
                text: `Running: ${cmd.slice(0, 80)}${cmd.length > 80 ? "..." : ""}`,
              });
            } else if (toolName === "write" || toolName === "edit") {
              const filePath = input.path || input.file || "";
              setWorkingStatus({
                type: "editing",
                text: `Editing: ${filePath}`,
              });
            } else if (toolName === "glob" || toolName === "grep") {
              setWorkingStatus({
                type: "searching",
                text: `Searching files...`,
              });
            } else if (toolName === "read") {
              const filePath = input.path || input.file || "";
              setWorkingStatus({
                type: "reading",
                text: `Reading: ${filePath}`,
              });
            } else {
              setWorkingStatus({
                type: "tool",
                text: `Using ${toolName}...`,
              });
            }
          }
          break;
        }

        case "file.edited": {
          const filePath = props.file || "";
          if (filePath) {
            setWorkingStatus({
              type: "editing",
              text: `Editing: ${filePath}`,
            });
          }
          break;
        }

        case "todo.updated": {
          const todos = props.todos || [];
          const active = todos.find((t) => t.status === "pending" || t.status === "in_progress");
          if (active) {
            setWorkingStatus({
              type: "todo",
              text: active.content || "Working...",
            });
          }
          break;
        }

        case "session.compacted":
          setWorkingStatus({ type: "thinking", text: "Compacting context..." });
          break;

        case "question.replied":
          setPendingQuestion(null);
          break;

        case "question.rejected":
          setPendingQuestion(null);
          break;

        case "permission.asked":
          setPendingPermission({
            id: props.id,
            sessionID: props.sessionID,
            messageID: props.tool?.messageID,
            callID: props.tool?.callID,
            type: props.permission,
            title: props.permission,
            patterns: props.patterns || [],
            metadata: props.metadata || {},
          });
          break;

        case "permission.replied":
          setPendingPermission(null);
          break;

        case "question.asked":
          setPendingQuestion({
            id: props.id,
            sessionID: props.sessionID,
            messageID: props.tool?.messageID,
            callID: props.tool?.callID,
            questions: props.questions || [],
          });
          break;
      }
    };

    readStream();
  }, []);

  useEffect(() => {
    if (!baseUrl || !activeSessionId) {
      setWorkingStatus(null);
      setPendingPermission(null);
      setPendingQuestion(null);
      return;
    }

    connectSSE();
    return () => {
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, [connectSSE, baseUrl, activeSessionId]);

  const checkStatus = useCallback(async () => {
    const sessionId = activeSessionIdRef.current;
    if (!sessionId) return;

    try {
      const headers = {};
      const auth = getAuthHeaderRef.current();
      if (auth) headers.Authorization = auth;

      const response = await fetch(`${baseUrlRef.current}/session/status`, { headers });
      if (!response.ok) return;

      const data = await response.json();
      const sessionStatus = data?.[sessionId]?.type;

      if (sessionStatus === "busy") {
        setWorkingStatus({ type: "thinking", text: "Thinking..." });
      } else {
        setWorkingStatus(null);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (!baseUrl || !activeSessionId) return;

    checkStatus();
    const interval = setInterval(checkStatus, 1500);
    return () => clearInterval(interval);
  }, [checkStatus, baseUrl, activeSessionId]);

  return { workingStatus, pendingPermission, setPendingPermission, pendingQuestion, setPendingQuestion };
}
