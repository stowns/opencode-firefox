import "@testing-library/jest-dom";
import browser, { clearMockStorage } from "./browser-mock";

declare global {
  // eslint-disable-next-line no-var
  var __mockStorage: Record<string, unknown> | undefined;
  // eslint-disable-next-line no-var
  var browser: typeof browser;
  // eslint-disable-next-line no-var
  var chrome: typeof browser;
}

globalThis.browser = browser;
globalThis.chrome = browser as unknown as typeof globalThis.chrome;
globalThis.__mockStorage = {};

beforeEach(() => {
  clearMockStorage();
  globalThis.__mockStorage = {};
  vi.clearAllMocks();
});
