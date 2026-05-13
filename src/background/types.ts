export interface SidebarMessage {
  type: string;
  serverUrl?: string;
  auth?: string;
  path?: string;
  options?: RequestInit;
  devMode?: boolean;
  id?: number;
  tabId?: number;
  sessionId?: string;
  text?: string;
  body?: Record<string, unknown>;
  system?: string;
}

export interface BackgroundMessage {
  type: string;
  data?: unknown;
  error?: string;
  id?: number;
  tabs?: browser.tabs.Tab[];
  tabId?: number;
  content?: unknown;
  event?: unknown;
  chunk?: string;
  modelID?: string;
}

export interface PromptRequest {
  id: number;
  url: string;
  headers: Record<string, string>;
  body: Record<string, unknown>;
}

export interface PromptChunk {
  id: number;
  text: string;
}

export interface PromptDone {
  id: number;
  modelID: string;
}
