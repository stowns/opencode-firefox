import browser from "webextension-polyfill";

export default browser;

export function getBrowserType(): "firefox" | "chrome" {
  if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.getURL) {
    if (chrome.runtime.getURL("").startsWith("moz-extension://")) {
      return "firefox";
    }
    if (chrome.runtime.getURL("").startsWith("chrome-extension://")) {
      return "chrome";
    }
  }
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("Firefox")) {
    return "firefox";
  }
  return "chrome";
}
