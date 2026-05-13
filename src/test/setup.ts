import "@testing-library/jest-dom";

declare global {
  // eslint-disable-next-line no-var
  var __mockStorage: Record<string, unknown> | undefined;
  // eslint-disable-next-line no-var
  var browser: {
    storage: {
      local: {
        get: (keys: string[] | string) => Promise<Record<string, unknown>>;
        set: (data: Record<string, unknown>) => Promise<void>;
      };
    };
    runtime: {
      connect: () => {
        postMessage: () => void;
        onMessage: { addListener: () => void };
        onDisconnect: { addListener: () => void };
      };
    };
    tabs: {
      query: () => Promise<unknown[]>;
      onActivated: { addListener: ReturnType<typeof vi.fn> };
      onRemoved: { addListener: ReturnType<typeof vi.fn> };
      onUpdated: { addListener: ReturnType<typeof vi.fn> };
    };
    windows: {
      onFocusChanged: { addListener: ReturnType<typeof vi.fn> };
    };
  };
}

global.browser = {
  storage: {
    local: {
      get: async (keys: string[] | string) => {
        const store = globalThis.__mockStorage || {};
        if (Array.isArray(keys)) {
          const result: Record<string, unknown> = {};
          keys.forEach((key) => {
            result[key] = store[key];
          });
          return result;
        }
        return store;
      },
      set: async (data: Record<string, unknown>) => {
        globalThis.__mockStorage = { ...(globalThis.__mockStorage || {}), ...data };
      },
    },
  },
  runtime: {
    connect: () => ({
      postMessage: () => {},
      onMessage: { addListener: () => {} },
      onDisconnect: { addListener: () => {} },
    }),
  },
  tabs: {
    query: async () => [],
    onActivated: { addListener: vi.fn() },
    onRemoved: { addListener: vi.fn() },
    onUpdated: { addListener: vi.fn() },
  },
  windows: {
    onFocusChanged: { addListener: vi.fn() },
  },
};
