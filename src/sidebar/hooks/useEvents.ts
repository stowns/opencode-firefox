import { useState, useEffect, useRef, useCallback } from "react";

interface WorkingStatus {
  type: string;
  text: string;
}

interface PendingPermission {
  id: string;
  sessionID?: string;
  messageID?: string;
  callID?: string;
  type?: string;
  title?: string;
  patterns?: string[];
  metadata?: Record<string, unknown>;
}

interface PendingQuestion {
  id: string;
  sessionID?: string;
  messageID?: string;
  callID?: string;
  questions: Array<{
    question?: string;
    header?: string;
    options?: Array<{
      label: string;
      description?: string;
    }>;
  }>;
}

interface EventPayload {
  type: string;
  properties?: Record<string, unknown>;
}

interface EventData {
  payload?: EventPayload;
}

export function useEvents(baseUrl: string, getAuthHeader: () => string | null, activeSessionId: string | null) {
  const [workingStatus, setWorkingStatus] = useState<WorkingStatus | null>(null);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const abortRef = useRef<AbortController | null>(null);
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
        const headers: Record<string, string> = { Accept: "text/event-stream" };
        const auth = getAuthHeaderRef.current();
        if (auth) headers.Authorization = auth;

        let buffer = "";

        const response = await fetch(`${baseUrlRef.current}/global/event`, {
          headers,
          signal: controller.signal,
        });

        if (!response.ok) return;

        const reader = response.body!.getReader();
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
                const event = JSON.parse(line.slice(6)) as EventData;
                handleEvent(event);
              } catch {
                // skip malformed events
              }
            }
          }
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError" && !controller.signal.aborted) {
          setTimeout(connectSSE, 3000);
        }
      }
    };

    const handleEvent = (event: EventData) => {
      const payload = event.payload;
      if (!payload) return;

      const type = payload.type;
      const props = payload.properties || {};

      const currentSessionId = activeSessionIdRef.current;
      if (!currentSessionId) return;

      const sessionId = props.sessionID as string | undefined;
      if (sessionId && sessionId !== currentSessionId) return;

      switch (type) {
        case "session.status": {
          const statusType = (props.status as { type?: string })?.type;
          if (statusType === "busy" || statusType === "retry") {
            setWorkingStatus({ type: "thinking", text: "Thinking..." });
          }
          break;
        }

        case "session.idle":
          setWorkingStatus(null);
          break;

        case "message.part.updated": {
          const part = props.part as { type?: string; state?: string; name?: string; input?: Record<string, string> } | undefined;
          if (part?.type === "tool" && part.state === "running") {
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
          const filePath = props.file as string | undefined;
          if (filePath) {
            setWorkingStatus({
              type: "editing",
              text: `Editing: ${filePath}`,
            });
          }
          break;
        }

        case "todo.updated": {
          const todos = (props.todos as Array<{ status?: string; content?: string }>) || [];
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
            id: props.id as string,
            sessionID: props.sessionID as string,
            messageID: (props.tool as { messageID?: string })?.messageID,
            callID: (props.tool as { callID?: string })?.callID,
            type: props.permission as string,
            title: props.permission as string,
            patterns: props.patterns as string[] | undefined,
            metadata: props.metadata as Record<string, unknown> | undefined,
          });
          break;

        case "permission.replied":
          setPendingPermission(null);
          break;

        case "question.asked":
          setPendingQuestion({
            id: props.id as string,
            sessionID: props.sessionID as string,
            messageID: (props.tool as { messageID?: string })?.messageID,
            callID: (props.tool as { callID?: string })?.callID,
            questions: (props.questions as PendingQuestion["questions"]) || [],
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
      const headers: Record<string, string> = {};
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
    } catch {
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
