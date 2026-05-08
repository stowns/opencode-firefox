import "@testing-library/jest-dom";

global.browser = {
  storage: {
    local: {
      get: async (keys) => {
        const store = global.__mockStorage || {};
        if (Array.isArray(keys)) {
          const result = {};
          keys.forEach((key) => {
            result[key] = store[key];
          });
          return result;
        }
        return store;
      },
      set: async (data) => {
        global.__mockStorage = { ...(global.__mockStorage || {}), ...data };
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
    onActivated: { addListener: () => {} },
    onRemoved: { addListener: () => {} },
    onUpdated: { addListener: () => {} },
  },
  windows: {
    onFocusChanged: { addListener: () => {} },
  },
};
