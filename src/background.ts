import type { Runtime, Tabs } from "firefox-webext-browser";

const OPENCODE_API_URL = "http://localhost:4096";

let sidebarPort: Runtime.Port | null = null;

browser.runtime.onConnect.addListener((port: Runtime.Port) => {
  if (port.name === "opencode-sidebar") {
    sidebarPort = port;
    port.onDisconnect.addListener(() => {
      sidebarPort = null;
    });
    port.onMessage.addListener(handleSidebarMessage);
  }
});

interface SidebarMessage {
  type: string;
  serverUrl?: string;
  auth?: string;
  path?: string;
  options?: RequestInit;
  devMode?: boolean;
  id?: number;
  tabId?: number;
}

async function handleSidebarMessage(message: SidebarMessage) {
  if (!sidebarPort) return;

  const serverUrl = message.serverUrl || "http://localhost:4096";
  const authHeader = message.auth;

  switch (message.type) {
    case "health-check":
      try {
        const headers = authHeader ? { Authorization: authHeader } : {};
        const res = await fetch(`${serverUrl}/global/health`, { headers });
        const data = await res.json();
        sidebarPort.postMessage({ type: "health-ok", data });
      } catch (err) {
        sidebarPort.postMessage({ type: "health-fail", error: (err as Error).message });
      }
      break;

    case "api-request":
      try {
        const { path, options = {}, devMode } = message;
        if (devMode) console.log("[background] api-request:", { path, method: options.method, body: options.body });
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
          ...(options.headers as Record<string, string> || {}),
        };
        const res = await fetch(`${serverUrl}${path}`, { ...options, headers });
        if (devMode) console.log("[background] api-response:", { status: res.status, contentType: res.headers.get("content-type") });
        const contentType = res.headers.get("content-type") || "";
        let data = null;
        if (contentType.includes("application/json")) {
          data = await res.json();
          if (devMode) console.log("[background] api-response data:", JSON.stringify(data).substring(0, 200));
        } else if (contentType.includes("text/html") || contentType.includes("text/plain")) {
          const text = await res.text();
          if (devMode) console.error("[background] non-JSON response:", text.substring(0, 500));
          sidebarPort.postMessage({ type: "api-error", id: message.id, error: `Server returned ${res.status}: ${text.substring(0, 200)}` });
          return;
        }
        sidebarPort.postMessage({ type: "api-response", id: message.id, data });
      } catch (err) {
        console.error("[background] api-error:", err);
        sidebarPort.postMessage({ type: "api-error", id: message.id, error: (err as Error).message });
      }
      break;

    case "get-tabs":
      try {
        const tabs = await browser.tabs.query({});
        const filtered = tabs.filter((t: Tabs.Tab) => {
          if (!t.url) return false;
          if (t.url.startsWith("about:")) return false;
          if (t.url.startsWith("moz-extension:")) return false;
          return true;
        });
        sidebarPort.postMessage({ type: "tabs-list", tabs: filtered });
      } catch (err) {
        sidebarPort.postMessage({ type: "tabs-error", error: (err as Error).message });
      }
      break;

    case "extract-tab-content":
      try {
        const results = await browser.tabs.sendMessage(message.tabId!, {
          type: "extract-content",
        });
        sidebarPort.postMessage({ type: "tab-content", tabId: message.tabId, content: results });
      } catch (err) {
        sidebarPort.postMessage({ type: "tab-content-error", tabId: message.tabId, error: (err as Error).message });
      }
      break;
  }
}

async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${OPENCODE_API_URL}/global/health`);
    return res.ok;
  } catch {
    return false;
  }
}

let tabUpdateTimer: ReturnType<typeof setTimeout> | null = null;

async function sendTabsToSidebar() {
  if (!sidebarPort) return;
  try {
    const tabs = await browser.tabs.query({});
    const filtered = tabs.filter((t: Tabs.Tab) => {
      if (!t.url) return false;
      if (t.url.startsWith("about:")) return false;
      if (t.url.startsWith("moz-extension:")) return false;
      return true;
    });
    sidebarPort.postMessage({ type: "tabs-list", tabs: filtered });
  } catch (err) {
    console.error("Failed to send tabs:", err);
  }
}

function scheduleTabUpdate() {
  if (tabUpdateTimer) clearTimeout(tabUpdateTimer);
  tabUpdateTimer = setTimeout(sendTabsToSidebar, 500);
}

browser.tabs.onRemoved.addListener(scheduleTabUpdate);
browser.tabs.onUpdated.addListener((_tabId: number, changeInfo: Tabs.OnUpdatedChangeInfoType, _tab: Tabs.Tab) => {
  if (changeInfo.status === "complete") {
    scheduleTabUpdate();
  }
});

browser.windows.onFocusChanged.addListener(async (windowId: number) => {
  if (!sidebarPort || windowId < 0) return;
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs.length > 0) {
      sidebarPort.postMessage({ type: "active-tab-changed", tabId: tabs[0].id });
    }
  } catch (err) {
    console.error("Failed to get active tab on window focus:", err);
  }
});
