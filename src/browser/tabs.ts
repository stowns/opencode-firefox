import { getBrowserType } from "./index";

const internalPrefixes = [
  "about:",
  "moz-extension:",
  "chrome://",
  "chrome-extension:",
];

export function isInternalUrl(url: string | undefined): boolean {
  if (!url) return true;
  return internalPrefixes.some((prefix) => url.startsWith(prefix));
}

export function getInternalPrefixes(): string[] {
  const browserType = getBrowserType();
  if (browserType === "firefox") {
    return ["about:", "moz-extension:"];
  }
  return ["chrome://", "chrome-extension:"];
}
