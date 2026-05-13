import type { Runtime } from "firefox-webext-browser";
import type { SidebarMessage } from "./types";

interface ActivePrompt {
  id: number;
  controller: AbortController;
}

let activePrompt: ActivePrompt | null = null;

export async function handleSendPrompt(port: Runtime.Port, message: SidebarMessage) {
  if (activePrompt) {
    activePrompt.controller.abort();
    activePrompt = null;
  }

  const controller = new AbortController();
  const promptId = message.id || 0;
  activePrompt = { id: promptId, controller };

  const serverUrl = message.serverUrl || "http://localhost:4096";
  const sessionId = message.sessionId || "";
  const text = message.text || "";
  const system = message.system;
  const authHeader = message.auth;

  const body: Record<string, unknown> = { parts: [{ type: "text", text }] };
  if (system) body.system = system;

  const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
  if (authHeader) fetchHeaders.Authorization = authHeader;

  try {
    const response = await fetch(`${serverUrl}/session/${sessionId}/message`, {
      method: "POST",
      headers: fetchHeaders,
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      port.postMessage({ type: "prompt-error", id: promptId, error: `Failed to get response (${response.status})` });
      activePrompt = null;
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("text/event-stream")) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";
      let modelID = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.data?.modelID) {
                modelID = parsed.data.modelID;
              }
              if (parsed.type === "chunk" && parsed.data?.parts) {
                for (const part of parsed.data.parts) {
                  if (part.type === "text" && part.text) {
                    assistantText += part.text;
                    port.postMessage({ type: "prompt-chunk", id: promptId, chunk: part.text });
                  }
                }
              }
            } catch {
              // skip non-JSON data lines
            }
          }
        }
      }

      port.postMessage({ type: "prompt-done", id: promptId, modelID });
    } else {
      const data = await response.json();
      port.postMessage({ type: "prompt-done", id: promptId, data });
    }
  } catch (e) {
    if ((e as Error).name !== "AbortError") {
      port.postMessage({ type: "prompt-error", id: promptId, error: (e as Error).message });
    }
  }

  activePrompt = null;
}

export function abortPrompt() {
  if (activePrompt) {
    activePrompt.controller.abort();
    activePrompt = null;
  }
}
