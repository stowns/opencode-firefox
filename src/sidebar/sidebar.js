let port = null;
let defaultSession = null;
let selectedTabs = new Set();
let allTabs = [];
let isStreaming = false;
let messageApiId = 0;
let serverConfig = { url: "http://localhost:4096", username: "opencode", password: "" };

// RAG state
let allProjects = [];
let selectedProjects = new Set();
let isIndexing = false;
let ragPluginDetected = false;

// DOM elements
const statusDot = document.getElementById("status-dot");
const statusText = document.getElementById("status-text");
const messagesEl = document.getElementById("messages");
const promptInput = document.getElementById("prompt-input");
const btnSend = document.getElementById("btn-send");
const btnTabs = document.getElementById("btn-tabs");
const btnRag = document.getElementById("btn-rag");
const btnSettings = document.getElementById("btn-settings");
const btnRefreshTabs = document.getElementById("btn-refresh-tabs");
const btnRefreshProjects = document.getElementById("btn-refresh-projects");
const btnRagGo = document.getElementById("btn-rag-go");
const btnSaveSettings = document.getElementById("btn-save-settings");
const tabContextPanel = document.getElementById("tab-context-panel");
const ragPanel = document.getElementById("rag-panel");
const settingsPanel = document.getElementById("settings-panel");
const tabsList = document.getElementById("tabs-list");
const projectsList = document.getElementById("projects-list");
const ragStatus = document.getElementById("rag-status");
const tabCount = document.getElementById("tab-count");
const settingPassword = document.getElementById("setting-password");
const settingUsername = document.getElementById("setting-username");
const settingUrl = document.getElementById("setting-url");

// Configure marked
marked.setOptions({
  breaks: true,
  gfm: true,
});

// Connect to background script
function connectBackground() {
  port = browser.runtime.connect({ name: "opencode-sidebar" });
  port.onMessage.addListener(handleBackgroundMessage);
  port.onDisconnect.addListener(() => {
    console.error("Disconnected from background script");
    setTimeout(connectBackground, 2000);
  });
}

function handleBackgroundMessage(msg) {
  switch (msg.type) {
    case "health-ok":
      setConnectionStatus("connected", `OpenCode ${msg.data.version || ""}`);
      loadInitialData();
      break;
    case "health-fail":
      defaultSession = null;
      setConnectionStatus("disconnected", "Not connected");
      break;
    case "api-response":
      handleApiResponse(msg.id, msg.data);
      break;
    case "api-error":
      handleApiError(msg.id, msg.error);
      break;
    case "tabs-list":
      renderTabsList(msg.tabs);
      break;
    case "tab-content":
      handleTabContent(msg.tabId, msg.content);
      break;
  }
}

function setConnectionStatus(status, text) {
  statusDot.className = status;
  statusText.textContent = text;
  const connected = status === "connected";
  promptInput.disabled = !connected;
  btnSend.disabled = !connected || !promptInput.value.trim() || isStreaming;
}

// API request via background
function apiRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const id = ++messageApiId;
    const handlers = { resolve, reject };
    window._apiCallbacks = window._apiCallbacks || {};
    window._apiCallbacks[id] = handlers;
    port.postMessage({ type: "api-request", id, path, options, auth: getAuthHeader(), serverUrl: serverConfig.url });
  });
}

function getAuthHeader() {
  if (!serverConfig.password) return null;
  const credentials = btoa(`${serverConfig.username}:${serverConfig.password}`);
  return `Basic ${credentials}`;
}

function handleApiResponse(id, data) {
  const handlers = window._apiCallbacks?.[id];
  if (handlers) {
    handlers.resolve(data);
    delete window._apiCallbacks[id];
  }
}

function handleApiError(id, error) {
  const handlers = window._apiCallbacks?.[id];
  if (handlers) {
    handlers.reject(new Error(error));
    delete window._apiCallbacks[id];
  }
}

// Health check
function checkHealth() {
  port.postMessage({ type: "health-check", auth: getAuthHeader(), serverUrl: serverConfig.url });
}

// Load server config from storage
async function loadServerConfig() {
  try {
    const stored = await browser.storage.local.get(["serverUrl", "serverUsername", "serverPassword"]);
    if (stored.serverUrl) serverConfig.url = stored.serverUrl;
    if (stored.serverUsername) serverConfig.username = stored.serverUsername;
    if (stored.serverPassword) serverConfig.password = stored.serverPassword;
  } catch (e) {
    console.warn("Failed to load server config:", e);
  }
  settingUrl.value = serverConfig.url;
  settingUsername.value = serverConfig.username;
  settingPassword.value = serverConfig.password;
}

// Save server config
async function saveServerConfig() {
  serverConfig.url = settingUrl.value.trim() || "http://localhost:4096";
  serverConfig.username = settingUsername.value.trim() || "opencode";
  serverConfig.password = settingPassword.value;
  defaultSession = null;
  await browser.storage.local.set({
    serverUrl: serverConfig.url,
    serverUsername: serverConfig.username,
    serverPassword: serverConfig.password,
  });
  settingsPanel.classList.add("hidden");
  checkHealth();
}

// Load initial data
async function loadInitialData() {
  await Promise.all([
    ensureDefaultSession(),
    loadTabs(),
  ]);
}

async function ensureDefaultSession() {
  if (defaultSession) return;
  try {
    const sessions = await apiRequest("/session");
    const existing = Array.isArray(sessions) ? sessions.find(s => s.title === "Browser Extension") : null;
    if (existing) {
      defaultSession = existing;
    } else {
      defaultSession = await apiRequest("/session", {
        method: "POST",
        body: JSON.stringify({ title: "Browser Extension" }),
      });
    }
    await loadMessages(defaultSession.id);
  } catch (e) {
    console.error("Failed to create default session:", e);
  }
}

// Messages
async function loadMessages(sessionId) {
  messagesEl.innerHTML = "";
  try {
    const messages = await apiRequest(`/session/${sessionId}/message`);
    const msgs = Array.isArray(messages) ? messages : [];

    if (msgs.length === 0) {
      showWelcome();
      return;
    }

    for (const msg of msgs) {
      renderMessage(msg);
    }
    scrollToBottom();
  } catch (e) {
    console.error("Failed to load messages:", e);
  }
}

function showWelcome() {
  messagesEl.innerHTML = `
    <div class="welcome">
      <h2>OpenCode</h2>
      <p>Ask me anything about the current page or selected tabs.</p>
    </div>
  `;
}

function renderMessage(msg) {
  const info = msg.info || msg;
  const isUser = info.role === "user";
  const parts = msg.parts || info.parts || [];
  const el = document.createElement("div");
  el.className = `message ${isUser ? "user" : "assistant"}`;

  const header = document.createElement("div");
  header.className = "message-header";

  const avatar = document.createElement("span");
  avatar.className = "message-avatar";
  avatar.textContent = isUser ? "You" : "OpenCode";

  header.appendChild(avatar);
  el.appendChild(header);

  const content = document.createElement("div");
  content.className = "message-content";

  if (isUser) {
    const text = parts.find(p => p.type === "text")?.text || "";
    const context = msg.context;

    const textEl = document.createElement("div");
    textEl.className = "message-text";
    textEl.textContent = text;
    content.appendChild(textEl);

    if (context) {
      const ctxBtn = document.createElement("button");
      ctxBtn.className = "message-context-btn";
      ctxBtn.textContent = "View Context";
      ctxBtn.onclick = () => {
        const existing = content.querySelector(".message-context");
        if (existing) {
          existing.remove();
          ctxBtn.textContent = "View Context";
        } else {
          const ctxEl = document.createElement("pre");
          ctxEl.className = "message-context";
          ctxEl.textContent = context;
          content.appendChild(ctxEl);
          ctxBtn.textContent = "Hide Context";
        }
      };
      content.appendChild(ctxBtn);
    }
  } else {
    const text = parts.find(p => p.type === "text")?.text || "";
    content.innerHTML = marked.parse(text);

    const copyBtn = document.createElement("button");
    copyBtn.className = "message-copy-btn";
    copyBtn.textContent = "Copy";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(text);
      copyBtn.textContent = "Copied!";
      setTimeout(() => copyBtn.textContent = "Copy", 2000);
    };
    content.appendChild(copyBtn);
  }

  el.appendChild(content);
  messagesEl.appendChild(el);
}

function addTypingIndicator() {
  const el = document.createElement("div");
  el.className = "message assistant";
  el.id = "typing-indicator";
  el.innerHTML = `
    <div class="message-header"><span class="message-avatar">OpenCode</span></div>
    <div class="message-content">
      <div class="typing-indicator"><span></span><span></span><span></span></div>
    </div>
  `;
  messagesEl.appendChild(el);
  scrollToBottom();
}

function removeTypingIndicator() {
  document.getElementById("typing-indicator")?.remove();
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Send prompt
async function sendPrompt() {
  const text = promptInput.value.trim();
  if (!text || isStreaming) return;

  if (!defaultSession) {
    await ensureDefaultSession();
    if (!defaultSession) return;
  }

  isStreaming = true;
  updateSendButton();

  // Build context from selected tabs
  let contextText = "";
  if (selectedTabs.size > 0) {
    const tabContents = await extractSelectedTabs();
    if (tabContents.length > 0) {
      contextText = tabContents.map(tc =>
        `[Context: Tab "${tc.title}" (${tc.url})]\n${tc.text}`
      ).join("\n\n");
    }
  }

  // Show user message immediately
  const userMsg = {
    role: "user",
    parts: [{ type: "text", text }],
    context: contextText,
  };
  renderMessage(userMsg);
  scrollToBottom();

  promptInput.value = "";
  updateSendButton();
  addTypingIndicator();

  try {
    const body = {
      parts: [{ type: "text", text }],
    };

    if (contextText) {
      body.system = contextText;
    }

    const fetchHeaders = { "Content-Type": "application/json" };
    const auth = getAuthHeader();
    if (auth) fetchHeaders.Authorization = auth;

    const response = await fetch(`${serverConfig.url}/session/${defaultSession.id}/message`, {
      method: "POST",
      headers: fetchHeaders,
      body: JSON.stringify(body),
    });

    removeTypingIndicator();

    if (response.ok) {
      const data = await response.json();
      renderMessage(data);
    } else {
      const errorEl = document.createElement("div");
      errorEl.className = "message assistant";
      errorEl.innerHTML = `
        <div class="message-avatar">!</div>
        <div class="message-content" style="color: var(--error);">
          Failed to get response (${response.status})
        </div>
      `;
      messagesEl.appendChild(errorEl);
    }
  } catch (e) {
    removeTypingIndicator();
    const errorEl = document.createElement("div");
    errorEl.className = "message assistant";
    errorEl.innerHTML = `
      <div class="message-avatar">!</div>
      <div class="message-content" style="color: var(--error);">
        Error: ${e.message}
      </div>
    `;
    messagesEl.appendChild(errorEl);
  } finally {
    isStreaming = false;
    updateSendButton();
    scrollToBottom();
  }
}

function updateSendButton() {
  const connected = statusDot.classList.contains("connected");
  btnSend.disabled = !connected || !promptInput.value.trim() || isStreaming;
}

// Tab context
async function loadTabs() {
  port.postMessage({ type: "get-tabs" });
}

function renderTabsList(tabs) {
  allTabs = tabs;
  tabsList.innerHTML = "";

  for (const tab of tabs) {
    const el = document.createElement("div");
    el.className = "tab-item";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `tab-${tab.id}`;
    checkbox.checked = tab.active || selectedTabs.has(tab.id);
    checkbox.onchange = () => toggleTab(tab.id, checkbox.checked);

    const label = document.createElement("label");
    label.htmlFor = `tab-${tab.id}`;
    label.textContent = tab.title || "Untitled";

    const urlSpan = document.createElement("span");
    urlSpan.className = "tab-url";
    urlSpan.textContent = tab.url || "";

    const wrapper = document.createElement("div");
    wrapper.style.flex = "1";
    wrapper.style.minWidth = "0";
    wrapper.appendChild(label);
    wrapper.appendChild(urlSpan);

    el.appendChild(checkbox);
    el.appendChild(wrapper);
    tabsList.appendChild(el);

    if (checkbox.checked) {
      selectedTabs.add(tab.id);
    }
  }

  updateTabCount();
}

function toggleTab(tabId, checked) {
  if (checked) {
    selectedTabs.add(tabId);
  } else {
    selectedTabs.delete(tabId);
  }
  updateTabCount();
}

function updateTabCount() {
  tabCount.textContent = `${selectedTabs.size} tab${selectedTabs.size !== 1 ? "s" : ""} selected`;
}

async function extractSelectedTabs() {
  const results = [];
  for (const tabId of selectedTabs) {
    try {
      port.postMessage({ type: "extract-tab-content", tabId });
      // This is async but we'll handle via callback
    } catch (e) {
      console.warn(`Failed to extract tab ${tabId}:`, e);
    }
  }

  // Wait for responses via a promise-based approach
  return new Promise((resolve) => {
    const pending = new Set(selectedTabs);
    const contents = [];

    window._tabContentCallbacks = window._tabContentCallbacks || {};
    window._tabContentCallbacks["resolve"] = (tabId, content) => {
      if (content && content.text) {
        contents.push(content);
      }
      pending.delete(tabId);
      if (pending.size === 0) {
        resolve(contents);
      }
    };

    // Timeout after 5 seconds
    setTimeout(() => resolve(contents), 5000);
  });
}

function handleTabContent(tabId, content) {
  if (window._tabContentCallbacks?.["resolve"]) {
    window._tabContentCallbacks["resolve"](tabId, content);
  }
}

// Event listeners
promptInput.addEventListener("input", updateSendButton);

promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendPrompt();
  }
});

btnSend.addEventListener("click", sendPrompt);

btnTabs.addEventListener("click", () => {
  tabContextPanel.classList.toggle("hidden");
  ragPanel.classList.add("hidden");
  settingsPanel.classList.add("hidden");
  btnTabs.classList.toggle("active");
  btnRag.classList.remove("active");
});

btnSettings.addEventListener("click", () => {
  settingsPanel.classList.toggle("hidden");
  tabContextPanel.classList.add("hidden");
  ragPanel.classList.add("hidden");
  btnRag.classList.remove("active");
});

btnRefreshTabs.addEventListener("click", loadTabs);
btnSaveSettings.addEventListener("click", saveServerConfig);

// RAG functions
async function detectRagPlugin() {
  try {
    const tools = await apiRequest("/experimental/tool/ids");
    ragPluginDetected = Array.isArray(tools) && tools.some(t => t.includes("memory") || t.includes("mem"));
  } catch {
    ragPluginDetected = false;
  }
  return ragPluginDetected;
}

async function loadProjects() {
  try {
    const projects = await apiRequest("/project");
    allProjects = Array.isArray(projects) ? projects : [];
    renderProjectsList();
  } catch (e) {
    console.error("Failed to load projects:", e);
    projectsList.innerHTML = '<div style="padding: 8px 12px; color: var(--error); font-size: 12px;">Failed to load projects</div>';
  }
}

function renderProjectsList() {
  projectsList.innerHTML = "";

  if (!ragPluginDetected) {
    const prompt = document.createElement("div");
    prompt.className = "rag-install-prompt";
    prompt.innerHTML = `
      <strong>opencode-mem plugin required</strong>
      <ol class="install-steps">
        <li>Install: <code>opencode plugin opencode-mem</code></li>
        <li>Restart <code>opencode serve</code></li>
      </ol>
    `;
    projectsList.appendChild(prompt);
    return;
  }

  if (allProjects.length === 0) {
    projectsList.innerHTML = '<div style="padding: 8px 12px; color: var(--text-secondary); font-size: 12px;">No projects found</div>';
  } else {
    for (const project of allProjects) {
      const projectPath = project.path || project.directory || "";
      if (!projectPath) continue;

      const el = document.createElement("div");
      el.className = "project-item";
      el.dataset.path = projectPath;

      if (isIndexing) {
        el.classList.add("disabled");
        const progress = document.createElement("div");
        progress.className = "project-progress";
        progress.innerHTML = '<div class="project-progress-bar" style="width: 0%"></div>';
        const text = document.createElement("span");
        text.className = "project-progress-text";
        text.textContent = "0%";
        el.appendChild(progress);
        el.appendChild(text);
      } else {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.id = `project-${projectPath}`;
        checkbox.checked = selectedProjects.has(projectPath);
        checkbox.onchange = () => {
          if (checkbox.checked) {
            selectedProjects.add(projectPath);
          } else {
            selectedProjects.delete(projectPath);
          }
        };

        const label = document.createElement("label");
        label.htmlFor = checkbox.id;
        label.textContent = project.name || projectPath.split("/").pop() || "Untitled";

        const pathSpan = document.createElement("span");
        pathSpan.className = "project-path";
        pathSpan.textContent = projectPath;

        const wrapper = document.createElement("div");
        wrapper.style.flex = "1";
        wrapper.style.minWidth = "0";
        wrapper.appendChild(label);
        wrapper.appendChild(pathSpan);

        el.appendChild(checkbox);
        el.appendChild(wrapper);
      }

      projectsList.appendChild(el);
    }
  }
}

function setRagStatus(text, type = "") {
  ragStatus.textContent = text;
  ragStatus.className = "rag-status" + (type ? ` ${type}` : "");
  ragStatus.classList.toggle("hidden", !text);
}

async function indexToMemory() {
  if (selectedProjects.size === 0 || selectedTabs.size === 0) return;

  isIndexing = true;
  btnRagGo.disabled = true;
  renderProjectsList();

  const tabContents = await extractSelectedTabs();
  if (tabContents.length === 0) {
    setRagStatus("No tab content extracted", "error");
    isIndexing = false;
    btnRagGo.disabled = false;
    renderProjectsList();
    return;
  }

  const combinedContent = tabContents.map(tc =>
    `[Source: ${tc.title} (${tc.url})]\n${tc.text}`
  ).join("\n\n---\n\n");

  let completed = 0;
  const total = selectedProjects.size;

  for (const projectPath of selectedProjects) {
    setRagStatus(`Indexing to ${projectPath}... (${completed + 1}/${total})`);

    try {
      const prompt = `Use the memory tool to add the following content to this project's memory. Use mode "add" and scope "project".\n\n${combinedContent}`;

      await apiRequest(`/session/${defaultSession.id}/message`, {
        method: "POST",
        body: JSON.stringify({
          parts: [{ type: "text", text: prompt }],
          noReply: true,
        }),
      });

      completed++;
      updateProjectProgress(projectPath, 100);
    } catch (e) {
      console.error(`Failed to index to ${projectPath}:`, e);
      updateProjectProgress(projectPath, -1);
    }
  }

  setRagStatus(`Indexed ${completed}/${total} projects`, "success");
  isIndexing = false;
  btnRagGo.disabled = false;
  renderProjectsList();

  setTimeout(() => setRagStatus(""), 5000);
}

function updateProjectProgress(projectPath, percent) {
  const items = projectsList.querySelectorAll(".project-item");
  for (const item of items) {
    if (item.dataset.path === projectPath) {
      if (percent < 0) {
        item.innerHTML = `<span style="color: var(--error); font-size: 11px;">Failed</span>`;
      } else {
        item.innerHTML = `<span class="project-complete">✓ Complete</span>`;
      }
      break;
    }
  }
}

// RAG event handlers
btnRag.addEventListener("click", async () => {
  ragPanel.classList.toggle("hidden");
  tabContextPanel.classList.add("hidden");
  settingsPanel.classList.add("hidden");
  btnRag.classList.toggle("active");
  btnTabs.classList.remove("active");

  if (!ragPanel.classList.contains("hidden")) {
    await detectRagPlugin();
    await loadProjects();
  }
});

btnRefreshProjects.addEventListener("click", async () => {
  await detectRagPlugin();
  await loadProjects();
});

btnRagGo.addEventListener("click", indexToMemory);

// Initialize
async function init() {
  await loadServerConfig();
  connectBackground();
  checkHealth();
}

init();

// Periodic health check
setInterval(checkHealth, 30000);
