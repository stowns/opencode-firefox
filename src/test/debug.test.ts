import { renderHook, act } from "@testing-library/react";
import { useOpenCode } from "../sidebar/hooks/useOpenCode";

vi.mock("../debug", () => ({
  sidebar: vi.fn(),
  enableDebug: vi.fn(),
  disableDebug: vi.fn(),
}));

describe("debug logging", () => {
  beforeEach(() => {
    globalThis.__mockStorage = {};
    vi.clearAllMocks();
  });

  it("calls disableDebug when developerMode is off", async () => {
    const { enableDebug, disableDebug } = await import("../debug");
    const { result } = renderHook(() => useOpenCode());

    expect(result.current.developerMode).toBe(false);
    expect(enableDebug).not.toHaveBeenCalled();
    expect(disableDebug).toHaveBeenCalled();
  });

  it("calls enableDebug when developerMode is turned on", async () => {
    const { enableDebug } = await import("../debug");
    const { result } = renderHook(() => useOpenCode());

    vi.clearAllMocks();

    act(() => {
      result.current.saveSettings({ developerMode: true });
    });

    expect(enableDebug).toHaveBeenCalled();
  });

  it("calls disableDebug when developerMode is turned off", async () => {
    const { enableDebug, disableDebug } = await import("../debug");
    const { result } = renderHook(() => useOpenCode());

    act(() => {
      result.current.saveSettings({ developerMode: true });
    });

    vi.clearAllMocks();

    act(() => {
      result.current.saveSettings({ developerMode: false });
    });

    expect(disableDebug).toHaveBeenCalled();
    expect(enableDebug).not.toHaveBeenCalled();
  });
});
