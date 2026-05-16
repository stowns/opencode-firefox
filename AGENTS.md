# AGENTS.md

## Project

Cross-browser extension (Firefox + Chrome) integrating OpenCode AI agent.

## Key commands

- `npm run dev:firefox` — build + watch for Firefox
- `npm run dev:chrome` — build + watch for Chrome
- `npm run dev:all` — build + watch both browsers in parallel
- `npm run dev` — alias for `dev:all`
- `npm run build:firefox` — production build for Firefox (outputs `.zip` via `web-ext`)
- `npm run build:chrome` — production build for Chrome (outputs `opencode-chrome.zip`)
- `npm run build:all` — builds both targets in parallel
- `npm run build` — alias for `build:all`
- `npm run web-ext` — launch Firefox extension in a temporary profile for dev
- `npm run lint` — validate manifest and code before submission
- `npm test` — run vitest test suite

## Build output

- `dist/firefox/` — Firefox build output
- `dist/chrome/` — Chrome build output
- `opencode-chrome.zip` — Chrome Web Store package
- `web-ext-artifacts/opencode-*.zip` — Firefox AMO package

## Structure

- `manifest.firefox.json` — Firefox-specific manifest (sidebar_action, browser_specific_settings)
- `manifest.chrome.json` — Chrome-specific manifest (side_panel, service_worker)
- `src/browser/` — cross-browser abstraction layer
  - `index.ts` — re-exports webextension-polyfill as `browser`
  - `tabs.ts` — cross-browser URL filtering (about:/moz-extension: vs chrome://)
  - `sidebar.ts` — sidebar/sidePanel initialization differences
- `src/background/` — background script (service worker / event page)
- `src/content/` — content scripts (injected into pages)
- `src/sidebar/` — React sidebar/side panel UI
- `src/shared/` — shared types and message protocol
- `src/test/` — vitest tests with browser API mocks

## Cross-browser architecture

All source code uses `import browser from "../browser"` instead of the global `browser` or `chrome` namespace. The `src/browser/` module wraps `webextension-polyfill` and provides:

- Unified `browser.*` API access (Promise-based in both browsers)
- `isInternalUrl()` — filters internal URLs for both browsers
- `getBrowserType()` — returns `"firefox"` or `"chrome"`
- `initSidebar()` / `openSidebar()` — abstracts sidebar_action vs sidePanel

Build-time manifest selection is handled by the Vite plugin via `BROWSER` env var.

## Firefox-specific notes

- Firefox requires `browser_specific_settings.gecko.id` for AMO signing
- Firefox uses `sidebar_action` in manifest for persistent sidebar
- Firefox background scripts use `"scripts": [...]` (not service_worker)
- Internal URLs to filter: `about:`, `moz-extension:`
- `web-ext` auto-reloads on file changes during `web-ext run`
- Run `npm run web-ext` to launch from `dist/firefox/`

## Chrome-specific notes

- Chrome uses `side_panel` in manifest (per-tab, not persistent)
- Chrome background scripts use `"service_worker": "..."` (single file)
- Chrome requires `"permissions": ["sidePanel"]`
- Internal URLs to filter: `chrome://`, `chrome-extension:`
- Load unpacked extension from `dist/chrome/` in chrome://extensions for development

## Submission

- AMO (addons.mozilla.org) requires signing; use `web-ext sign --api-key ... --api-secret ...`
- Self-distributed .xpi files do not require signing but won't work on release Firefox without enterprise policy
- Chrome Web Store: upload `opencode-chrome.zip` via the Developer Dashboard

## Code Standards
- Update existing unit tests when making changes to existing features
- Add new unit tests for new features
- Update documentation when existing functionality changes
- Add documentation when new functionality is added
- Prefer writing DRY code even if refactors are required
