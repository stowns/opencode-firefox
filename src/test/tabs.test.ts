import {
  setupTabListeners,
  setSidebarPort,
  sendTabs,
  scheduleTabUpdate,
} from "../background/tabs";
import type { Runtime, Tabs } from "firefox-webext-browser";

describe("tabs background module", () => {
  let mockPort: Partial<Runtime.Port>;

  beforeEach(() => {
    mockPort = {
      postMessage: vi.fn(),
    };
    setSidebarPort(mockPort as Runtime.Port);
    vi.clearAllMocks();
  });

  afterEach(() => {
    setSidebarPort(null);
    vi.restoreAllMocks();
  });

  describe("sendTabs", () => {
    it("posts tabs-list message to sidebar port", async () => {
      const mockTabs = [
        { id: 1, url: "https://example.com", title: "Example" },
        { id: 2, url: "https://test.com", title: "Test", active: true },
      ];
      vi.spyOn(browser.tabs, "query").mockResolvedValue(mockTabs as Tabs.Tab[]);

      await sendTabs();

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: "tabs-list",
        tabs: mockTabs,
      });
    });

    it("filters out about: and moz-extension: URLs", async () => {
      const mockTabs = [
        { id: 1, url: "https://example.com", title: "Example" },
        { id: 2, url: "about:blank", title: "Blank" },
        { id: 3, url: "moz-extension://abc", title: "Extension" },
      ];
      vi.spyOn(browser.tabs, "query").mockResolvedValue(mockTabs as Tabs.Tab[]);

      await sendTabs();

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: "tabs-list",
        tabs: [{ id: 1, url: "https://example.com", title: "Example" }],
      });
    });

    it("does nothing when sidebar port is null", async () => {
      setSidebarPort(null);
      await sendTabs();
      expect(mockPort.postMessage).not.toHaveBeenCalled();
    });
  });

  describe("scheduleTabUpdate", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("sends tabs after 500ms delay", async () => {
      vi.spyOn(browser.tabs, "query").mockResolvedValue([]);

      scheduleTabUpdate();
      await vi.advanceTimersByTimeAsync(500);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: "tabs-list",
        tabs: [],
      });
    });

    it("cancels previous timer on subsequent calls", async () => {
      vi.spyOn(browser.tabs, "query").mockResolvedValue([]);

      scheduleTabUpdate();
      scheduleTabUpdate();
      await vi.advanceTimersByTimeAsync(500);

      expect(mockPort.postMessage).toHaveBeenCalledTimes(1);
    });
  });

  describe("setupTabListeners", () => {
    it("sends active-tab-changed on tab activation", async () => {
      setupTabListeners();

      const onActivated = browser.tabs.onActivated.addListener.mock.calls[0][0];
      await onActivated({ tabId: 42, windowId: 1 } as Tabs.OnActivatedActiveInfoType);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: "active-tab-changed",
        tabId: 42,
      });
    });

    it("sends active-tab-changed on window focus change", async () => {
      vi.spyOn(browser.tabs, "query").mockResolvedValue([
        { id: 99, active: true } as Tabs.Tab,
      ]);

      setupTabListeners();

      const onFocusChanged =
        browser.windows.onFocusChanged.addListener.mock.calls[0][0];
      await onFocusChanged(1);

      expect(mockPort.postMessage).toHaveBeenCalledWith({
        type: "active-tab-changed",
        tabId: 99,
      });
    });

    it("does not send active-tab-changed on window focus change with invalid windowId", async () => {
      setupTabListeners();

      const onFocusChanged =
        browser.windows.onFocusChanged.addListener.mock.calls[0][0];
      await onFocusChanged(-1);

      expect(mockPort.postMessage).not.toHaveBeenCalled();
    });
  });
});
