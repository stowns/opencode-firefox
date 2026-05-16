# Release Notes

## 1.0.1 (2026-05-13)

### Features
- TypeScript migration — entire codebase migrated from JavaScript to TypeScript for improved type safety and developer experience
- Shared message protocol — abstracted sidebar/background communication into a dedicated protocol file, removing string literal usage
- Background communication layer — background script now handles all OpenCode communication with a pub/sub interface abstracting request/response vs SSE-based data

### Improvements
- System context prompt updated to be more explicit about what is visible to the user
- Debug logging using the `debug` package

### Bug Fixes
- Fixed double cancel/abort and session restore race condition
- Fixed message rendering regression
- Fixed active tab tracking regression
- Fixed tab count regression

### Testing
- Added unit tests for hooks, message handling, and tab tracking

### Documentation
- Added data-flow documentation
- README updates and formatting fixes

---

## 1.0.0 (2026-05-08)

### Features
- Initial release of OpenCode Firefox Extension
- Sidebar integration with OpenCode AI agent
- Tab context — select open browser tabs to include their content as context
- Workspace support
  - Select a directory to scope the agent's changes
  - Sessions automatically scoped to workspaces
  - Switch between recently used workspaces with configurable history
- Developer mode for viewing context and clearing sessions
- Configurable server URL, credentials, and workspace history size
- Developer mode — view context sent with each message and clear sessions
- OpenCode basic auth support — authentication via `opencode serve OPENCODE_SERVER_PASSWORD=<pwd>`

### Architecture
- Manifest V3 extension with background script, content scripts, and sidebar UI
- Content extraction from web pages via content scripts
- Local storage for workspace paths, session IDs, and server credentials

### Privacy
- All data stored locally in the browser
- No telemetry or usage data collection
- Communication only with local OpenCode instance
