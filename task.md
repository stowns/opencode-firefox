# Goal
Build a Firefox extension which integrates with OpenCode. The experience should be like the OpenCode VsCode extension but for the browser. When a user clicks the opencode icon in the browsers add-on bar, it opens a side panel resembling a standard agent chat experience. By default, the agent is provided with the active browser tab as context. However, the user is able to select additional open tabs via checkboxs which provide additional context to the agent. Responses from the agent include an icon for copying to clipboard. Responses are formatted.

# Status
**Phase 1-5 complete** — Extension installed and running in Firefox.

## What's built
- `manifest.json` — MV3 with sidebar_action, tabs, scripting, storage permissions
- `src/background.js` — Message relay between sidebar and tabs, API proxy to OpenCode server
- `src/content/extract.js` — Content script that extracts readable text from pages
- `src/sidebar/sidebar.html` — Sidebar panel with chat UI, session/model/tab panels
- `src/sidebar/sidebar.css` — Dark theme styles with Firefox CSS variable integration
- `src/sidebar/sidebar.js` — Full chat UI with streaming, markdown rendering, copy buttons

## Features implemented
- Connects to `opencode serve` at `http://localhost:4096`
- Health check with connection status indicator
- Chat interface with markdown rendering (marked.js)
- Copy-to-clipboard on assistant responses
- Session list, create new session, switch sessions
- Model selector (fetches from OpenCode config)
- Tab context selector with checkboxes (active tab selected by default)
- Content extraction from selected tabs injected into prompts
- Persist last session/model via browser.storage.local
- Typing indicator during streaming
- Keyboard shortcut: Enter to send, Shift+Enter for newline

## Next steps / TODO
- Test with actual `opencode serve` running
- Improve tab content extraction (readability algorithm)
- Add proper icons (currently placeholder blue squares)
- Consider native messaging for auto-starting opencode serve
- Add error handling for SSE streaming responses
- Add session deletion/forking
- Add keyboard shortcut to open sidebar
