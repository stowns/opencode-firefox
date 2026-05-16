import type { Runtime, Tabs } from "firefox-webext-browser";
import { MSG_TABS_LIST, MSG_TABS_ERROR, MSG_TAB_CONTENT, MSG_TAB_CONTENT_ERROR, MSG_ACTIVE_TAB_CHANGED } from "../shared/protocol";

let tabUpdateTimer: ReturnType<typeof setTimeout> | null = null;
let sidebarPort: Runtime.Port | null = null;

export function setSidebarPort(port: Runtime.Port | null) {
  sidebarPort = port;
}

function filterTabs(tabs: Tabs.Tab[]): Tabs.Tab[] {
  return tabs.filter((t) => {
    if (!t.url) return false;
    if (t.url.startsWith("about:")) return false;
    if (t.url.startsWith("moz-extension:")) return false;
    return true;
  });
}

export async function sendTabs() {
  if (!sidebarPort) return;
  try {
    const tabs = await browser.tabs.query({});
    sidebarPort.postMessage({ type: MSG_TABS_LIST, tabs: filterTabs(tabs) });
  } catch (err) {
    console.error("Failed to send tabs:", err);
  }
}

export function scheduleTabUpdate() {
  if (tabUpdateTimer) clearTimeout(tabUpdateTimer);
  tabUpdateTimer = setTimeout(sendTabs, 500);
}

export async function handleGetTabs(port: Runtime.Port) {
  try {
    const tabs = await browser.tabs.query({});
    port.postMessage({ type: MSG_TABS_LIST, tabs: filterTabs(tabs) });
  } catch (err) {
    port.postMessage({ type: MSG_TABS_ERROR, error: (err as Error).message });
  }
}

export async function handleExtractTabContent(port: Runtime.Port, tabId: number) {
  try {
    const results = await browser.tabs.sendMessage(tabId, { type: "extract-content" });
    port.postMessage({ type: MSG_TAB_CONTENT, tabId, content: results });
  } catch (err) {
    port.postMessage({ type: MSG_TAB_CONTENT_ERROR, tabId, error: (err as Error).message });
  }
}

export function setupTabListeners() {
  browser.tabs.onRemoved.addListener(scheduleTabUpdate);
  browser.tabs.onUpdated.addListener((_tabId: number, changeInfo: Tabs.OnUpdatedChangeInfoType, _tab: Tabs.Tab) => {
    if (changeInfo.status === "complete") {
      scheduleTabUpdate();
    }
  });

  browser.tabs.onActivated.addListener(async (activeInfo: Tabs.OnActivatedActiveInfoType) => {
    if (!sidebarPort) return;
    sidebarPort.postMessage({ type: MSG_ACTIVE_TAB_CHANGED, tabId: activeInfo.tabId });
  });

  browser.windows.onFocusChanged.addListener(async (windowId: number) => {
    if (!sidebarPort || windowId < 0) return;
    try {
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      if (tabs.length > 0) {
        sidebarPort.postMessage({ type: MSG_ACTIVE_TAB_CHANGED, tabId: tabs[0].id });
      }
    } catch (err) {
      console.error("Failed to get active tab on window focus:", err);
    }
  });
}
