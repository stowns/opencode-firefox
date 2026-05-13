import type { Runtime } from "firefox-webext-browser";
import type { SidebarToBackground } from "../shared/protocol";
import {
  MSG_HEALTH_CHECK,
  MSG_API_REQUEST,
  MSG_GET_TABS,
  MSG_EXTRACT_TAB_CONTENT,
  MSG_SUBSCRIBE_EVENTS,
  MSG_UNSUBSCRIBE_EVENTS,
  MSG_SEND_PROMPT,
  MSG_ABORT_PROMPT,
  MSG_SET_DEVELOPER_MODE,
} from "../shared/protocol";
import { handleHealthCheck, handleApiRequest } from "./api";
import { subscribeEvents, unsubscribeEvents, setSidebarPort as setEventsPort, abortSSE } from "./events";
import { handleSendPrompt, abortPrompt } from "./prompt";
import { setSidebarPort as setTabsPort, handleGetTabs, handleExtractTabContent, sendTabs } from "./tabs";
import { enableDebug, disableDebug } from "../debug";

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

      port.onMessage.addListener((message: SidebarToBackground) => {
        handleMessage(port, message);
      });

      sendTabs();
    }
  });
}

async function handleMessage(port: Runtime.Port, message: SidebarToBackground) {
  switch (message.type) {
    case MSG_HEALTH_CHECK:
      await handleHealthCheck(port, message);
      break;

    case MSG_API_REQUEST:
      await handleApiRequest(port, message);
      break;

    case MSG_GET_TABS:
      await handleGetTabs(port);
      break;

    case MSG_EXTRACT_TAB_CONTENT:
      if (message.tabId !== undefined) {
        await handleExtractTabContent(port, message.tabId);
      }
      break;

    case MSG_SUBSCRIBE_EVENTS:
      if (message.sessionId) {
        subscribeEvents(message.sessionId);
      }
      break;

    case MSG_UNSUBSCRIBE_EVENTS:
      unsubscribeEvents();
      break;

    case MSG_SEND_PROMPT:
      await handleSendPrompt(port, message);
      break;

    case MSG_ABORT_PROMPT:
      abortPrompt();
      break;

    case MSG_SET_DEVELOPER_MODE:
      if (message.enabled) {
        enableDebug();
      } else {
        disableDebug();
      }
      break;
  }
}
