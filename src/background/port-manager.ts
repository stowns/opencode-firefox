import type { Runtime } from "firefox-webext-browser";
import type { SidebarMessage } from "./types";
import { handleHealthCheck, handleApiRequest } from "./api";
import { subscribeEvents, unsubscribeEvents, setSidebarPort as setEventsPort, abortSSE } from "./events";
import { handleSendPrompt, abortPrompt } from "./prompt";
import { setSidebarPort as setTabsPort, handleGetTabs, handleExtractTabContent, sendTabs } from "./tabs";

let sidebarPort: Runtime.Port | null = null;

export function getSidebarPort(): Runtime.Port | null {
  return sidebarPort;
}

export function setupPortListener() {
  browser.runtime.onConnect.addListener((port: Runtime.Port) => {
    if (port.name === "opencode-sidebar") {
      sidebarPort = port;
      setEventsPort(port);
      setTabsPort(port);

      port.onDisconnect.addListener(() => {
        sidebarPort = null;
        setEventsPort(null);
        setTabsPort(null);
        abortPrompt();
      });

      port.onMessage.addListener((message: SidebarMessage) => {
        handleMessage(port, message);
      });

      sendTabs();
    }
  });
}

async function handleMessage(port: Runtime.Port, message: SidebarMessage) {
  switch (message.type) {
    case "health-check":
      await handleHealthCheck(port, message);
      break;

    case "api-request":
      await handleApiRequest(port, message);
      break;

    case "get-tabs":
      await handleGetTabs(port);
      break;

    case "extract-tab-content":
      if (message.tabId !== undefined) {
        await handleExtractTabContent(port, message.tabId);
      }
      break;

    case "subscribe-events":
      if (message.sessionId) {
        subscribeEvents(message.sessionId);
      }
      break;

    case "unsubscribe-events":
      unsubscribeEvents();
      break;

    case "send-prompt":
      await handleSendPrompt(port, message);
      break;

    case "abort-prompt":
      abortPrompt();
      break;
  }
}
