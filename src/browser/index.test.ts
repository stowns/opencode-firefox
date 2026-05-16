import { getBrowserType } from "../browser";
import { setMockBrowserType } from "../test/browser-mock";

describe("getBrowserType", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns firefox when runtime URL starts with moz-extension://", () => {
    setMockBrowserType("firefox");
    expect(getBrowserType()).toBe("firefox");
  });

  it("returns chrome when runtime URL starts with chrome-extension://", () => {
    setMockBrowserType("chrome");
    expect(getBrowserType()).toBe("chrome");
  });

  it("falls back to userAgent when runtime URL is unavailable", () => {
    const originalChrome = (globalThis as Record<string, unknown>).chrome;
    (globalThis as Record<string, unknown>).chrome = undefined;

    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 Firefox/120.0",
      configurable: true,
    });

    expect(getBrowserType()).toBe("firefox");

    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      configurable: true,
    });
    (globalThis as Record<string, unknown>).chrome = originalChrome;
  });

  it("defaults to chrome when no browser indicators are found", () => {
    const originalChrome = (globalThis as Record<string, unknown>).chrome;
    (globalThis as Record<string, unknown>).chrome = {
      runtime: { getURL: vi.fn(() => "") },
    } as unknown as typeof chrome;

    const originalUserAgent = navigator.userAgent;
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0",
      configurable: true,
    });

    expect(getBrowserType()).toBe("chrome");

    Object.defineProperty(navigator, "userAgent", {
      value: originalUserAgent,
      configurable: true,
    });
    (globalThis as Record<string, unknown>).chrome = originalChrome;
  });
});
