export const MSG_HEALTH_CHECK = "health-check";
export const MSG_API_REQUEST = "api-request";
export const MSG_GET_TABS = "get-tabs";
export const MSG_EXTRACT_TAB_CONTENT = "extract-tab-content";
export const MSG_SUBSCRIBE_EVENTS = "subscribe-events";
export const MSG_UNSUBSCRIBE_EVENTS = "unsubscribe-events";
export const MSG_SEND_PROMPT = "send-prompt";
export const MSG_ABORT_PROMPT = "abort-prompt";
export const MSG_SET_DEVELOPER_MODE = "set-developer-mode";

export const MSG_HEALTH_OK = "health-ok";
export const MSG_HEALTH_FAIL = "health-fail";
export const MSG_API_RESPONSE = "api-response";
export const MSG_API_ERROR = "api-error";
export const MSG_TABS_LIST = "tabs-list";
export const MSG_TABS_ERROR = "tabs-error";
export const MSG_ACTIVE_TAB_CHANGED = "active-tab-changed";
export const MSG_TAB_CONTENT = "tab-content";
export const MSG_TAB_CONTENT_ERROR = "tab-content-error";
export const MSG_EVENT = "event";
export const MSG_PROMPT_CHUNK = "prompt-chunk";
export const MSG_PROMPT_DONE = "prompt-done";
export const MSG_PROMPT_ERROR = "prompt-error";

export type SidebarToBackground =
  | { type: typeof MSG_HEALTH_CHECK; auth?: string; serverUrl: string }
  | { type: typeof MSG_API_REQUEST; id: number; path: string; options?: RequestInit; auth?: string; serverUrl: string }
  | { type: typeof MSG_GET_TABS }
  | { type: typeof MSG_EXTRACT_TAB_CONTENT; tabId: number }
  | { type: typeof MSG_SUBSCRIBE_EVENTS; sessionId: string }
  | { type: typeof MSG_UNSUBSCRIBE_EVENTS }
  | { type: typeof MSG_SEND_PROMPT; id: number; serverUrl: string; auth?: string; sessionId: string; text: string; body: Record<string, unknown>; system?: string }
  | { type: typeof MSG_ABORT_PROMPT }
  | { type: typeof MSG_SET_DEVELOPER_MODE; enabled: boolean };

export type BackgroundToSidebar =
  | { type: typeof MSG_HEALTH_OK; data: Record<string, unknown> }
  | { type: typeof MSG_HEALTH_FAIL; error: string }
  | { type: typeof MSG_API_RESPONSE; id: number; data: unknown }
  | { type: typeof MSG_API_ERROR; id: number; error: string }
  | { type: typeof MSG_TABS_LIST; tabs: browser.tabs.Tab[] }
  | { type: typeof MSG_TABS_ERROR; error: string }
  | { type: typeof MSG_ACTIVE_TAB_CHANGED; tabId: number }
  | { type: typeof MSG_TAB_CONTENT; tabId: number; content: { title: string; url: string; text: string } }
  | { type: typeof MSG_TAB_CONTENT_ERROR; tabId: number; error: string }
  | { type: typeof MSG_EVENT; event: unknown }
  | { type: typeof MSG_PROMPT_CHUNK; id: number; chunk: string }
  | { type: typeof MSG_PROMPT_DONE; id: number; modelID?: string; data?: unknown }
  | { type: typeof MSG_PROMPT_ERROR; id: number; error: string };

export type PortMessage = SidebarToBackground | BackgroundToSidebar;
