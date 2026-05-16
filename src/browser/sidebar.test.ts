import { initSidebar, openSidebar } from "../browser/sidebar";
import browser from "../browser";
import { setMockBrowserType } from "../test/browser-mock";

describe("sidebar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("initSidebar", () => {
    it("calls setPanelBehavior on Chrome", async () => {
      setMockBrowserType("chrome");
      await initSidebar();
      expect(browser.sidePanel.setPanelBehavior).toHaveBeenCalledWith({
        openPanelOnActionClick: false,
      });
    });

    it("does nothing on Firefox", async () => {
      setMockBrowserType("firefox");
      await initSidebar();
      expect(browser.sidePanel.setPanelBehavior).not.toHaveBeenCalled();
    });

    it("handles setPanelBehavior errors gracefully", async () => {
      setMockBrowserType("chrome");
      vi.spyOn(browser.sidePanel, "setPanelBehavior").mockRejectedValue(
        new Error("API unavailable")
      );
      await expect(initSidebar()).resolves.not.toThrow();
    });
  });

  describe("openSidebar", () => {
    it("calls sidePanel.open on Chrome", async () => {
      setMockBrowserType("chrome");
      await openSidebar();
      expect(browser.sidePanel.open).toHaveBeenCalledWith({});
    });

    it("passes tabId when provided on Chrome", async () => {
      setMockBrowserType("chrome");
      await openSidebar(42);
      expect(browser.sidePanel.open).toHaveBeenCalledWith({ tabId: 42 });
    });

    it("does nothing on Firefox", async () => {
      setMockBrowserType("firefox");
      await openSidebar();
      expect(browser.sidePanel.open).not.toHaveBeenCalled();
    });

    it("handles open errors gracefully", async () => {
      setMockBrowserType("chrome");
      vi.spyOn(browser.sidePanel, "open").mockRejectedValue(
        new Error("API unavailable")
      );
      await expect(openSidebar()).resolves.not.toThrow();
    });
  });
});
