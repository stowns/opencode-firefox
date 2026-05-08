const OPENCODE_API_URL = "http://localhost:4096";

let sidebarPort = null;

browser.runtime.onConnect.addListener((port) => {
  if (port.name === "opencode-sidebar") {
    sidebarPort = port;
    port.onDisconnect.addListener(() => {
      sidebarPort = null;
    });
    port.onMessage.addListener(handleSidebarMessage);
  }
});

async function handleSidebarMessage(message) {
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
        sidebarPort.postMessage({ type: "health-fail", error: err.message });
      }
      break;

    case "api-request":
      try {
        const { path, options = {} } = message;
        const headers = {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
          ...options.headers,
        };
        const res = await fetch(`${serverUrl}${path}`, { ...options, headers });
        const data = await res.json();
        sidebarPort.postMessage({ type: "api-response", id: message.id, data });
      } catch (err) {
        sidebarPort.postMessage({ type: "api-error", id: message.id, error: err.message });
      }
      break;

    case "get-tabs":
      try {
        const tabs = await browser.tabs.query({});
        const filtered = tabs.filter(t => {
          if (!t.url) return false;
          if (t.url.startsWith("about:")) return false;
          if (t.url.startsWith("moz-extension:")) return false;
          return true;
        });
        sidebarPort.postMessage({ type: "tabs-list", tabs: filtered });
      } catch (err) {
        sidebarPort.postMessage({ type: "tabs-error", error: err.message });
      }
      break;

    case "extract-tab-content":
      try {
        const results = await browser.tabs.sendMessage(message.tabId, {
          type: "extract-content",
        });
        sidebarPort.postMessage({ type: "tab-content", tabId: message.tabId, content: results });
      } catch (err) {
        sidebarPort.postMessage({ type: "tab-content-error", tabId: message.tabId, error: err.message });
      }
      break;
  }
}

async function checkHealth() {
  try {
    const res = await fetch(`${OPENCODE_API_URL}/global/health`);
    return res.ok;
  } catch {
    return false;
  }
}

let tabUpdateTimer = null;

async function sendTabsToSidebar() {
  if (!sidebarPort) return;
  try {
    const tabs = await browser.tabs.query({});
    const filtered = tabs.filter(t => {
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
browser.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete") {
    scheduleTabUpdate();
  }
});
