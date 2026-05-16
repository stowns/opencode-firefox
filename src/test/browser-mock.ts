import { vi } from "vitest";

let browserType: "firefox" | "chrome" = "firefox";

export function setMockBrowserType(type: "firefox" | "chrome") {
  browserType = type;
}

export function getMockBrowserType(): "firefox" | "chrome" {
  return browserType;
}

const createEvent = () => ({
  addListener: vi.fn(),
  removeListener: vi.fn(),
  hasListener: vi.fn(),
  hasListeners: vi.fn(),
});

const mockStorage: Record<string, unknown> = {};

export function clearMockStorage() {
  Object.keys(mockStorage).forEach((key) => delete mockStorage[key]);
}

const browser = {
  runtime: {
    connect: vi.fn(() => ({
      postMessage: vi.fn(),
      disconnect: vi.fn(),
      onMessage: createEvent(),
      onDisconnect: createEvent(),
    })),
    onConnect: createEvent(),
    sendMessage: vi.fn(),
    getURL: vi.fn((path: string) => {
      const prefix = browserType === "firefox" ? "moz-extension://" : "chrome-extension://";
      return `${prefix}test/${path}`;
    }),
  },
  tabs: {
    query: vi.fn(() => Promise.resolve([])),
    sendMessage: vi.fn(),
    onActivated: createEvent(),
    onRemoved: createEvent(),
    onUpdated: createEvent(),
  },
  windows: {
    onFocusChanged: createEvent(),
  },
  storage: {
    local: {
      get: vi.fn(async (keys: string | string[]) => {
        if (Array.isArray(keys)) {
          const result: Record<string, unknown> = {};
          keys.forEach((key) => {
            result[key] = mockStorage[key];
          });
          return result;
        }
        return { ...mockStorage };
      }),
      set: vi.fn(async (data: Record<string, unknown>) => {
        Object.assign(mockStorage, data);
      }),
    },
  },
  sidePanel: {
    setPanelBehavior: vi.fn(() => Promise.resolve()),
    open: vi.fn(() => Promise.resolve()),
  },
};

export default browser;
