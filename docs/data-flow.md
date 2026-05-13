# Data Flow

## Architecture Overview

Network architecture:

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│   Sidebar (UI)  │◄───────►│  Background      │◄───────►│  OpenCode       │
│   React app     │  Port   │  Service Worker  │  HTTP   │  Server         │
│                 │  msgs   │                  │  / SSE  │  (localhost:4096│
└─────────────────┘         └──────────────────┘         └─────────────────┘
                                    │
                                    │ tab messages
                                    ▼
                            ┌──────────────────┐
                            │  Content Script  │
                            │  (page context)  │
                            └──────────────────┘
```

## Protocol

Message types are defined as constants and discriminated unions in `src/shared/protocol.ts` and shared between the sidebar and background:

- **Sidebar→Background constants:** `MSG_HEALTH_CHECK`, `MSG_API_REQUEST`, `MSG_GET_TABS`, `MSG_EXTRACT_TAB_CONTENT`, `MSG_SUBSCRIBE_EVENTS`, `MSG_UNSUBSCRIBE_EVENTS`, `MSG_SEND_PROMPT`, `MSG_ABORT_PROMPT`, `MSG_SET_DEVELOPER_MODE`
- **Background→Sidebar constants:** `MSG_HEALTH_OK`, `MSG_HEALTH_FAIL`, `MSG_API_RESPONSE`, `MSG_API_ERROR`, `MSG_TABS_LIST`, `MSG_TABS_ERROR`, `MSG_ACTIVE_TAB_CHANGED`, `MSG_TAB_CONTENT`, `MSG_TAB_CONTENT_ERROR`, `MSG_EVENT`, `MSG_PROMPT_CHUNK`, `MSG_PROMPT_DONE`, `MSG_PROMPT_ERROR`

Both sides import these constants, ensuring compile-time safety for all port communication.

## Layers

### 1. Sidebar (React)

**Entry:** `src/sidebar/main.tsx` → `src/sidebar/App.tsx`

All state and server communication is managed by the `useOpenCode` hook (`src/sidebar/hooks/useOpenCode.ts`).

The sidebar connects to the background script via a **runtime port**:

```ts
const port = browser.runtime.connect({ name: "opencode-sidebar" });
```

Messages sent from the sidebar to the background (`SidebarToBackground`):

| Constant | Purpose |
|---|---|
| `MSG_HEALTH_CHECK` | Check server connectivity |
| `MSG_API_REQUEST` | Generic API proxy (sessions, permissions, questions) |
| `MSG_GET_TABS` | Request browser tab list |
| `MSG_EXTRACT_TAB_CONTENT` | Extract content from a specific tab |
| `MSG_SUBSCRIBE_EVENTS` | Subscribe to SSE events for a session |
| `MSG_UNSUBSCRIBE_EVENTS` | Unsubscribe from SSE events |
| `MSG_SEND_PROMPT` | Send a user message to the AI |
| `MSG_ABORT_PROMPT` | Abort an in-flight prompt |
| `MSG_SET_DEVELOPER_MODE` | Toggle developer mode (enables debug logging) |

Messages received from the background (`BackgroundToSidebar`):

| Constant | Purpose |
|---|---|
| `MSG_HEALTH_OK` / `MSG_HEALTH_FAIL` | Health check results |
| `MSG_API_RESPONSE` / `MSG_API_ERROR` | API request results |
| `MSG_TABS_LIST` / `MSG_TABS_ERROR` | Tab list results |
| `MSG_ACTIVE_TAB_CHANGED` | Active tab changed notification |
| `MSG_TAB_CONTENT` / `MSG_TAB_CONTENT_ERROR` | Extracted tab content |
| `MSG_EVENT` | Forwarded SSE event from server |
| `MSG_PROMPT_CHUNK` | Streaming text chunk |
| `MSG_PROMPT_DONE` / `MSG_PROMPT_ERROR` | Prompt completion/error |

### 2. Background Script (Service Worker)

**Entry:** `src/background/index.ts`

The background script acts as a **proxy and router** between the sidebar and the server. It has five modules:

#### port-manager.ts

Central message router. Listens for `browser.runtime.onConnect` from the sidebar, dispatches incoming messages to the appropriate handler:

```
sidebar message → handleMessage() → route to api/prompt/events/tabs handler
```

#### api.ts

Generic API proxy. Handles `MSG_HEALTH_CHECK` and `MSG_API_REQUEST` messages:

```
sidebar ──[MSG_API_REQUEST]──► background ──[fetch]──► server
sidebar ◄──[MSG_API_RESPONSE]── background ◄──[JSON]── server
```

Used for: session CRUD, permissions, questions, abort.

#### prompt.ts

Handles `MSG_SEND_PROMPT` messages. Sends user messages to the server and reads the SSE streaming response:

```
sidebar ──[MSG_SEND_PROMPT]──► background ──[POST /session/{id}/message]──► server
sidebar ◄──[MSG_PROMPT_CHUNK]── background ◄──[SSE stream]── server
sidebar ◄──[MSG_PROMPT_DONE]── background (on stream end)
```

The SSE response is parsed for `message.part.updated` events (text parts) and `message.updated` events (modelID).

#### events.ts

SSE event subscription. Connects to the server's `/global/event` endpoint as a persistent SSE stream:

```
sidebar ──[MSG_SUBSCRIBE_EVENTS]──► background ──[GET /global/event]──► server
sidebar ◄──[MSG_EVENT]── background ◄──[SSE stream]── server
```

Events are filtered by session ID before forwarding. Handles: `session.status`, `session.idle`, `message.part.updated`, `file.edited`, `todo.updated`, `permission.asked`, `permission.replied`, `question.asked`, etc.

Auto-reconnects after 3 seconds on connection failure.

#### tabs.ts

Tab management. Queries browser tabs, filters internal pages, listens for tab changes:

```
sidebar ──[MSG_GET_TABS]──► background ──[browser.tabs.query]──► browser
sidebar ◄──[MSG_TABS_LIST]── background
```

Listeners:
- `browser.tabs.onActivated` → sends `MSG_ACTIVE_TAB_CHANGED`
- `browser.tabs.onUpdated` (status=complete) → sends `MSG_TABS_LIST`
- `browser.tabs.onRemoved` → sends `MSG_TABS_LIST`
- `browser.windows.onFocusChanged` → sends `MSG_ACTIVE_TAB_CHANGED`

### 3. Content Script

**File:** `src/content/extract.ts`

Injected into all pages. Listens for `extract-content` messages from the background script:

```
background ──[browser.tabs.sendMessage(tabId, {type: "extract-content"})]──► content script
background ◄──[{title, url, text}]── content script
```

Extracts page title, URL, and text content (prefers `article`, `main`, `[role='main']` selectors, falls back to `body`). Truncates to 8000 characters.

### 4. OpenCode Server

External server at `http://localhost:4096` (configurable). Endpoints used:

| Endpoint | Method | Purpose |
|---|---|---|
| `/global/health` | GET | Health check |
| `/global/event` | GET (SSE) | Event stream |
| `/session` | GET/POST | List/create sessions |
| `/session/{id}` | GET/PATCH/DELETE | Manage session |
| `/session/{id}/message` | GET/POST | Get messages / send prompt (SSE response) |
| `/session/{id}/permissions/{id}` | POST | Respond to permission request |
| `/question/{id}/reply` | POST | Answer a question |

## Request Flow Examples

### Sending a Prompt

```
User types message → sendPrompt()
  │
  ├─► setMessages([userMsg])          (UI updates immediately)
  │
  ├─► port.postMessage({
  │       type: MSG_SEND_PROMPT,
  │       id: 1,
  │       serverUrl: "http://localhost:4096",
  │       sessionId: "ses_...",
  │       text: "hello",
  │       body: { parts: [{ type: "text", text: "hello" }] },
  │       system: "context..."
  │     })
  │     │
  │     ├─► fetch(POST /session/{id}/message)
  │     │     │
  │     │     └─► Server processes, streams SSE response
  │     │           │
  │     │           ├─► message.part.updated (text) → { type: MSG_PROMPT_CHUNK, chunk: "..." } → setMessages()
  │     │           └─► message.part.updated (step-finish) → { type: MSG_PROMPT_DONE, modelID: "..." } → setIsStreaming(false)
  │     │
  │     └─► /global/event stream also delivers:
  │           ├─► session.status (busy) → setWorkingStatus("Thinking...")
  │           ├─► message.part.updated (tool) → setWorkingStatus("Running: ...")
  │           └─► session.idle → setWorkingStatus(null), setIsStreaming(false)
  │
  └─► UI renders streaming text in MessageList
```

### Loading Sessions

```
Connection established → ensureDefaultSession()
  │
  ├─► port.postMessage({ type: MSG_API_REQUEST, id: 1, path: "/session", serverUrl: "..." })
  │     │
  │     ├─► fetch(GET /session)
  │     │     └─► Server returns session list
  │     │
  │     └─► port.postMessage({ type: MSG_API_RESPONSE, id: 1, data: sessions })
  │           │
  │           └─► setSessions(filtered), switchSession(first)
  │
  └─► port.postMessage({ type: MSG_API_REQUEST, id: 2, path: "/session/{id}/message", serverUrl: "..." })
        │
        ├─► fetch(GET /session/{id}/message)
        │     └─► Server returns message history
        │
        └─► port.postMessage({ type: MSG_API_RESPONSE, id: 2, data: messages })
              │
              └─► setMessages(history)
```

### Tab Context

```
User opens Tabs panel → loadTabs()
  │
  ├─► port.postMessage({ type: MSG_GET_TABS })
  │     │
  │     ├─► browser.tabs.query({})
  │     │     └─► Filter internal pages
  │     │
  │     └─► port.postMessage({ type: MSG_TABS_LIST, tabs: [...] })
  │           │
  │           └─► setTabs(), auto-select all tabs
  │
  └─► User sends prompt with selected tabs
        │
        ├─► port.postMessage({ type: MSG_EXTRACT_TAB_CONTENT, tabId: 42 }) for each selected tab
        │     │
        │     ├─► browser.tabs.sendMessage(tabId, { type: "extract-content" })
        │     │     └─► Content script extracts page text
        │     │
        │     └─► port.postMessage({ type: MSG_TAB_CONTENT, tabId: 42, content: { title, url, text } })
        │           │
        │           └─► Collect all tab contents
        │
        └─► sendPrompt(text, system: tabContext)
```
