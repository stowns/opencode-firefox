import type { Runtime } from "firefox-webext-browser";
import type { SidebarToBackground } from "../shared/protocol";
import { MSG_HEALTH_CHECK, MSG_API_REQUEST, MSG_HEALTH_OK, MSG_HEALTH_FAIL, MSG_API_RESPONSE, MSG_API_ERROR } from "../shared/protocol";
import { apiDebug } from "../debug";

export async function handleHealthCheck(port: Runtime.Port, message: Extract<SidebarToBackground, { type: typeof MSG_HEALTH_CHECK }>) {
  const serverUrl = message.serverUrl || "http://localhost:4096";
  const authHeader = message.auth;
  try {
    const headers = authHeader ? { Authorization: authHeader } : {};
    const res = await fetch(`${serverUrl}/global/health`, { headers });
    const data = await res.json();
    port.postMessage({ type: MSG_HEALTH_OK, data });
  } catch (err) {
    port.postMessage({ type: MSG_HEALTH_FAIL, error: (err as Error).message });
  }
}

export async function handleApiRequest(port: Runtime.Port, message: Extract<SidebarToBackground, { type: typeof MSG_API_REQUEST }>) {
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
      port.postMessage({ type: MSG_API_ERROR, id: message.id, error: `Server returned ${res.status}: ${text.substring(0, 200)}` });
      return;
    }
    port.postMessage({ type: MSG_API_RESPONSE, id: message.id, data });
  } catch (err) {
    console.error("[api] api-error:", err);
    port.postMessage({ type: MSG_API_ERROR, id: message.id, error: (err as Error).message });
  }
}
