# AGENTS.md

## Project

Firefox extension/add-on.

## Key commands

- `npx web-ext run` — launch extension in a temporary Firefox profile for dev
- `npx web-ext lint` — validate manifest and code before submission
- `npx web-ext build` — produce a distributable .zip in `web-ext-artifacts/`

## Structure

- `manifest.json` — extension entrypoint (Manifest V3)
- `src/background.js` — service worker / background script
- `src/content.js` — content scripts (injected into pages)
- `src/popup.html` / `src/popup.js` — extension popup UI

## Firefox-specific notes

- Firefox supports Manifest V3 but some APIs differ from Chrome (e.g., `browser.*` namespace instead of `chrome.*`, though `chrome.*` is also available via polyfill)
- Use `browser.*` APIs with `await` — they return Promises, not callbacks
- Content scripts run in an isolated world; cannot access page JS directly
- For cross-browser compatibility, consider `webextension-polyfill`
- Firefox requires explicit `host_permissions` in manifest for webRequest blocking
- `web-ext` auto-reloads on file changes during `web-ext run`

## Submission

- AMO (addons.mozilla.org) requires signing; use `web-ext sign --api-key ... --api-secret ...`
- Self-distributed .xpi files do not require signing but won't work on release Firefox without enterprise policy

## Code Standards
- Update existing unit tests when making changes to existing features
- Add new unit tests for new features
- Update documentation when existing functionality changes
- Add documentation when new functionality is added
- Prefer writing DRY code even if refactors are required
