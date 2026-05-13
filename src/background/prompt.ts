import type { Runtime } from "firefox-webext-browser";
import type { SidebarMessage } from "./types";
import { promptDebug } from "../debug";

interface ActivePrompt {
  id: number;
  controller: AbortController;
}

let activePrompt: ActivePrompt | null = null;

export async function handleSendPrompt(port: Runtime.Port, message: SidebarMessage) {
  if (activePrompt) {
    promptDebug("aborting previous prompt");
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

  promptDebug("send-prompt: session=%s id=%d", sessionId, promptId);

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
      promptDebug("prompt error: status=%d", response.status);
      port.postMessage({ type: "prompt-error", id: promptId, error: `Failed to get response (${response.status})` });
      activePrompt = null;
      return;
    }

    const contentType = response.headers.get("content-type") || "";
    promptDebug("response content-type: %s", contentType);
    if (contentType.includes("text/event-stream")) {
      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
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
              const payloadType = parsed.payload?.type;
              const props = parsed.payload?.properties;

              if (payloadType === "message.updated" && props?.info?.modelID) {
                modelID = props.info.modelID;
                promptDebug("modelID: %s", modelID);
              }

              if (payloadType === "message.part.updated" && props?.part) {
                const part = props.part;
                if (part.type === "step-finish") {
                  promptDebug("step-finish, sending prompt-done");
                  port.postMessage({ type: "prompt-done", id: promptId, modelID });
                }
              }
            } catch {
              // skip non-JSON data lines
            }
          }
        }
      }

      promptDebug("stream ended, sending prompt-done modelID=%s", modelID);
      port.postMessage({ type: "prompt-done", id: promptId, modelID });
    } else {
      const data = await response.json();
      promptDebug("non-SSE response, sending prompt-done");
      port.postMessage({ type: "prompt-done", id: promptId, data });
    }
  } catch (e) {
    if ((e as Error).name !== "AbortError") {
      promptDebug("prompt exception: %s", (e as Error).message);
      port.postMessage({ type: "prompt-error", id: promptId, error: (e as Error).message });
    }
  }

  activePrompt = null;
}

export function abortPrompt() {
  if (activePrompt) {
    promptDebug("abort-prompt called");
    activePrompt.controller.abort();
    activePrompt = null;
  }
}
