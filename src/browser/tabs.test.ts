import { isInternalUrl, getInternalPrefixes } from "../browser/tabs";
import { setMockBrowserType } from "../test/browser-mock";

describe("tabs browser utilities", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("isInternalUrl", () => {
    it("returns true for undefined URL", () => {
      expect(isInternalUrl(undefined)).toBe(true);
    });

    it("returns true for empty string", () => {
      expect(isInternalUrl("")).toBe(true);
    });

    it("returns true for about: URLs", () => {
      expect(isInternalUrl("about:blank")).toBe(true);
      expect(isInternalUrl("about:config")).toBe(true);
    });

    it("returns true for moz-extension: URLs", () => {
      expect(isInternalUrl("moz-extension://abc123/sidebar.html")).toBe(true);
    });

    it("returns true for chrome:// URLs", () => {
      expect(isInternalUrl("chrome://extensions")).toBe(true);
      expect(isInternalUrl("chrome://settings")).toBe(true);
    });

    it("returns true for chrome-extension: URLs", () => {
      expect(isInternalUrl("chrome-extension://xyz/sidebar.html")).toBe(true);
    });

    it("returns false for regular HTTPS URLs", () => {
      expect(isInternalUrl("https://example.com")).toBe(false);
      expect(isInternalUrl("https://app.opencode.ai")).toBe(false);
    });

    it("returns false for HTTP URLs", () => {
      expect(isInternalUrl("http://localhost:3000")).toBe(false);
    });
  });

  describe("getInternalPrefixes", () => {
    it("returns Firefox prefixes when browser type is firefox", () => {
      setMockBrowserType("firefox");
      expect(getInternalPrefixes()).toEqual(["about:", "moz-extension:"]);
    });

    it("returns Chrome prefixes when browser type is chrome", () => {
      setMockBrowserType("chrome");
      expect(getInternalPrefixes()).toEqual(["chrome://", "chrome-extension:"]);
    });
  });
});
