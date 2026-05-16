import { renderHook, act } from "@testing-library/react";
import { useOpenCode } from "../sidebar/hooks/useOpenCode";
import browser from "../browser";

describe("useOpenCode tab management", () => {
  let portListeners: { onMessage: ((msg: Record<string, unknown>) => void) | null; onDisconnect: (() => void) | null };

  beforeEach(() => {
    globalThis.__mockStorage = {};
    portListeners = { onMessage: null, onDisconnect: null };
    vi.spyOn(browser.runtime, "connect").mockImplementation(() => ({
      postMessage: vi.fn(),
      onMessage: {
        addListener: (fn: (msg: Record<string, unknown>) => void) => {
          portListeners.onMessage = fn;
        },
      },
      onDisconnect: {
        addListener: (fn: () => void) => {
          portListeners.onDisconnect = fn;
        },
      },
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("removes closed tabs from selectedTabs", async () => {
    const { result } = renderHook(() => useOpenCode());

    await new Promise((r) => setTimeout(r, 10));

    act(() => {
      portListeners.onMessage?.({
        type: "tabs-list",
        tabs: [
          { id: 1, url: "https://example.com", title: "Tab 1" },
          { id: 2, url: "https://test.com", title: "Tab 2" },
          { id: 3, url: "https://other.com", title: "Tab 3" },
        ],
      });
    });

    expect(result.current.tabs).toHaveLength(3);
    expect(result.current.selectedTabs.size).toBe(3);

    act(() => {
      portListeners.onMessage?.({
        type: "tabs-list",
        tabs: [
          { id: 1, url: "https://example.com", title: "Tab 1" },
          { id: 3, url: "https://other.com", title: "Tab 3" },
        ],
      });
    });

    expect(result.current.tabs).toHaveLength(2);
    expect(result.current.selectedTabs.size).toBe(2);
    expect(result.current.selectedTabs.has(2)).toBe(false);
    expect(result.current.selectedTabs.has(1)).toBe(true);
    expect(result.current.selectedTabs.has(3)).toBe(true);
  });

  it("adds new tabs to selectedTabs", async () => {
    const { result } = renderHook(() => useOpenCode());

    await new Promise((r) => setTimeout(r, 10));

    act(() => {
      portListeners.onMessage?.({
        type: "tabs-list",
        tabs: [
          { id: 1, url: "https://example.com", title: "Tab 1" },
        ],
      });
    });

    expect(result.current.selectedTabs.size).toBe(1);

    act(() => {
      portListeners.onMessage?.({
        type: "tabs-list",
        tabs: [
          { id: 1, url: "https://example.com", title: "Tab 1" },
          { id: 2, url: "https://new.com", title: "Tab 2" },
        ],
      });
    });

    expect(result.current.selectedTabs.size).toBe(2);
    expect(result.current.selectedTabs.has(2)).toBe(true);
  });

  it("clears all selected tabs when clearSelectedTabs is called", async () => {
    const { result } = renderHook(() => useOpenCode());

    await new Promise((r) => setTimeout(r, 10));

    act(() => {
      portListeners.onMessage?.({
        type: "tabs-list",
        tabs: [
          { id: 1, url: "https://example.com", title: "Tab 1" },
          { id: 2, url: "https://test.com", title: "Tab 2" },
        ],
      });
    });

    expect(result.current.selectedTabs.size).toBe(2);

    act(() => {
      result.current.clearSelectedTabs();
    });

    expect(result.current.selectedTabs.size).toBe(0);
  });

  it("does not re-select all tabs when tabs-list is received after initial load", async () => {
    const { result } = renderHook(() => useOpenCode());

    await new Promise((r) => setTimeout(r, 10));

    act(() => {
      portListeners.onMessage?.({
        type: "tabs-list",
        tabs: [
          { id: 1, url: "https://example.com", title: "Tab 1" },
          { id: 2, url: "https://test.com", title: "Tab 2" },
          { id: 3, url: "https://other.com", title: "Tab 3" },
        ],
      });
    });

    expect(result.current.selectedTabs.size).toBe(3);

    act(() => {
      result.current.toggleTab(2, false);
    });

    expect(result.current.selectedTabs.has(2)).toBe(false);
    expect(result.current.selectedTabs.size).toBe(2);

    act(() => {
      portListeners.onMessage?.({
        type: "tabs-list",
        tabs: [
          { id: 1, url: "https://example.com", title: "Tab 1" },
          { id: 2, url: "https://test.com", title: "Tab 2" },
          { id: 3, url: "https://other.com", title: "Tab 3" },
        ],
      });
    });

    expect(result.current.selectedTabs.has(2)).toBe(false);
    expect(result.current.selectedTabs.size).toBe(2);
  });

  it("does not overwrite stored deselections when tabs-list arrives before config loads", async () => {
    globalThis.__mockStorage = { selectedTabs: [1, 3] };

    let resolveGet: (value: unknown) => void;
    const getBlocker = new Promise<unknown>((r) => {
      resolveGet = r;
    });

    const originalGet = vi.fn().mockImplementation(async (keys: string | string[]) => {
      if (Array.isArray(keys)) {
        const result: Record<string, unknown> = {};
        keys.forEach((key) => {
          result[key] = globalThis.__mockStorage![key];
        });
        return result;
      }
      return { ...globalThis.__mockStorage };
    });

    vi.spyOn(browser.storage.local, "get").mockImplementation(async (keys) => {
      const result = await originalGet(keys);
      await getBlocker;
      return result;
    });

    const { result } = renderHook(() => useOpenCode());

    await new Promise((r) => setTimeout(r, 10));

    act(() => {
      portListeners.onMessage?.({
        type: "tabs-list",
        tabs: [
          { id: 1, url: "https://example.com", title: "Tab 1" },
          { id: 2, url: "https://test.com", title: "Tab 2" },
          { id: 3, url: "https://other.com", title: "Tab 3" },
        ],
      });
    });

    act(() => {
      resolveGet!(undefined);
    });

    await new Promise((r) => setTimeout(r, 10));

    expect(result.current.selectedTabs.size).toBe(2);
    expect(result.current.selectedTabs.has(1)).toBe(true);
    expect(result.current.selectedTabs.has(2)).toBe(false);
    expect(result.current.selectedTabs.has(3)).toBe(true);

    const setCalls = (browser.storage.local.set as ReturnType<typeof vi.fn>).mock.calls;
    const selectedTabsSets = setCalls.filter((c) => c[0] && "selectedTabs" in c[0]);
    for (const call of selectedTabsSets) {
      expect(call[0].selectedTabs).not.toContain(2);
    }
  });
});
