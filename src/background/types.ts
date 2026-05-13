export type { SidebarToBackground, BackgroundToSidebar, PortMessage } from "../shared/protocol";

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
