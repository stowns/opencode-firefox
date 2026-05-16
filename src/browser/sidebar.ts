import browser, { getBrowserType } from "./index";

export async function initSidebar() {
  if (getBrowserType() === "chrome") {
    try {
      await browser.sidePanel?.setPanelBehavior?.({ openPanelOnActionClick: false });
    } catch {
      // sidePanel API may not be available in all Chrome versions
    }
  }
}

export async function openSidebar(tabId?: number) {
  if (getBrowserType() === "chrome") {
    try {
      const options: Record<string, unknown> = {};
      if (tabId !== undefined) {
        options.tabId = tabId;
      }
      await (browser.sidePanel as Record<string, unknown>)?.open?.(options);
    } catch {
      // sidePanel API may not be available
    }
  }
}
