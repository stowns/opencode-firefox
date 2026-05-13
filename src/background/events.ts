import type { Runtime } from "firefox-webext-browser";

let sseAbortController: AbortController | null = null;
let subscribedSessionId: string | null = null;
let sidebarPort: Runtime.Port | null = null;

export function setSidebarPort(port: Runtime.Port | null) {
  sidebarPort = port;
}

export function subscribeEvents(sessionId: string) {
  subscribedSessionId = sessionId;
  if (!sseAbortController) {
    connectSSE();
  }
}

export function unsubscribeEvents() {
  subscribedSessionId = null;
}

function connectSSE() {
  if (sseAbortController) {
    sseAbortController.abort();
  }

  const controller = new AbortController();
  sseAbortController = controller;

  const readStream = async () => {
    try {
      const headers: Record<string, string> = { Accept: "text/event-stream" };

      const response = await fetch(`http://localhost:4096/global/event`, {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) return;

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
              forwardEvent(event);
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

  readStream();
}

function forwardEvent(event: unknown) {
  if (!subscribedSessionId || !sidebarPort) return;

  const payload = (event as { payload?: { type?: string; properties?: Record<string, unknown> } })?.payload;
  if (!payload) return;

  const props = payload.properties || {};
  const sessionId = props.sessionID as string | undefined;
  if (sessionId && sessionId !== subscribedSessionId) return;

  sidebarPort.postMessage({ type: "event", event });
}

export function abortSSE() {
  if (sseAbortController) {
    sseAbortController.abort();
    sseAbortController = null;
  }
  subscribedSessionId = null;
}
