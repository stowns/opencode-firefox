import type { Runtime } from "firefox-webext-browser";
import { MSG_EVENT } from "../shared/protocol";
import { eventsDebug } from "../debug";

let sseAbortController: AbortController | null = null;
let subscribedSessionId: string | null = null;
let sidebarPort: Runtime.Port | null = null;

export function setSidebarPort(port: Runtime.Port | null) {
  sidebarPort = port;
}

export function subscribeEvents(sessionId: string) {
  eventsDebug("subscribe-events: session=%s", sessionId);
  subscribedSessionId = sessionId;
  if (!sseAbortController) {
    connectSSE();
  }
}

export function unsubscribeEvents() {
  eventsDebug("unsubscribe-events");
  subscribedSessionId = null;
}

function connectSSE() {
  if (sseAbortController) {
    sseAbortController.abort();
  }

  const controller = new AbortController();
  sseAbortController = controller;

  eventsDebug("connecting to SSE stream: %s/global/event", "http://localhost:4096");

  const readStream = async () => {
    try {
      const headers: Record<string, string> = { Accept: "text/event-stream" };

      const response = await fetch(`http://localhost:4096/global/event`, {
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        eventsDebug("SSE connection failed: status=%d", response.status);
        return;
      }

      eventsDebug("SSE connected");

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
        eventsDebug("SSE error, reconnecting in 3s: %s", (e as Error).message);
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

  eventsDebug("forwarding event: type=%s", payload.type);
  sidebarPort.postMessage({ type: MSG_EVENT, event });
}

export function abortSSE() {
  eventsDebug("abort-SSE");
  if (sseAbortController) {
    sseAbortController.abort();
    sseAbortController = null;
  }
  subscribedSessionId = null;
}
