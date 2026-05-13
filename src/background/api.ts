import type { Runtime } from "firefox-webext-browser";
import type { SidebarMessage } from "./types";
import { apiDebug } from "../debug";

export async function handleHealthCheck(port: Runtime.Port, message: SidebarMessage) {
  const serverUrl = message.serverUrl || "http://localhost:4096";
  const authHeader = message.auth;
  try {
    const headers = authHeader ? { Authorization: authHeader } : {};
    const res = await fetch(`${serverUrl}/global/health`, { headers });
    const data = await res.json();
    port.postMessage({ type: "health-ok", data });
  } catch (err) {
    port.postMessage({ type: "health-fail", error: (err as Error).message });
  }
}

export async function handleApiRequest(port: Runtime.Port, message: SidebarMessage) {
  const serverUrl = message.serverUrl || "http://localhost:4096";
  const authHeader = message.auth;
  try {
    const { path, options = {} } = message;
    apiDebug("api-request: %O", { path, method: options.method, body: options.body });
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(authHeader ? { Authorization: authHeader } : {}),
      ...(options.headers as Record<string, string> || {}),
    };
    const res = await fetch(`${serverUrl}${path}`, { ...options, headers });
    apiDebug("api-response: %O", { status: res.status, contentType: res.headers.get("content-type") });
    const contentType = res.headers.get("content-type") || "";
    let data = null;
    if (contentType.includes("application/json")) {
      data = await res.json();
      apiDebug("api-response data: %s", JSON.stringify(data).substring(0, 200));
    } else if (contentType.includes("text/html") || contentType.includes("text/plain")) {
      const text = await res.text();
      apiDebug("non-JSON response: %s", text.substring(0, 500));
      port.postMessage({ type: "api-error", id: message.id, error: `Server returned ${res.status}: ${text.substring(0, 200)}` });
      return;
    }
    port.postMessage({ type: "api-response", id: message.id, data });
  } catch (err) {
    console.error("[api] api-error:", err);
    port.postMessage({ type: "api-error", id: message.id, error: (err as Error).message });
  }
}
