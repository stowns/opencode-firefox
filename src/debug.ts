import debug from "debug";

export const logDebug = debug("opencode");
export const apiDebug = debug("opencode:api");
export const sidebarDebug = debug("opencode:sidebar");
export const eventsDebug = debug("opencode:events");
export const promptDebug = debug("opencode:prompt");

export function enableDebug() {
  debug.enable("opencode:*");
}

export function disableDebug() {
  debug.disable();
}
