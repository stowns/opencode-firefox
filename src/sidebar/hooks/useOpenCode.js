import { useState, useEffect, useRef, useCallback } from "react";
import { marked } from "marked";
import { useEvents } from "./useEvents";

marked.setOptions({ breaks: true, gfm: true });

export function useOpenCode() {
  const portRef = useRef(null);
  const callbacksRef = useRef({});
  const tabContentCallbacksRef = useRef(null);
  const messageApiIdRef = useRef(0);
  const knownTabIdsRef = useRef(new Set());

  const [status, setStatus] = useState("connecting");
  const [statusText, setStatusText] = useState("Connecting...");
  const [messages, setMessages] = useState([]);
  const [tabs, setTabs] = useState([]);
  const [selectedTabs, setSelectedTabs] = useState(new Set());
  const [activeTabId, setActiveTabId] = useState(null);
  const [serverConfig, setServerConfig] = useState({
    url: "http://localhost:4096",
    username: "opencode",
    password: "",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tabsOpen, setTabsOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [activeSession, setActiveSession] = useState(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [workspacePath, setWorkspacePath] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [recentWorkspaces, setRecentWorkspaces] = useState([]);
  const [workspaceHistorySize, setWorkspaceHistorySize] = useState(5);
  const [developerMode, setDeveloperMode] = useState(false);
  const workspacePathRef = useRef(workspacePath);
  const serverConfigRef = useRef(serverConfig);
  const developerModeRef = useRef(developerMode);

  useEffect(() => {
    developerModeRef.current = developerMode;
  }, [developerMode]);

  const debug = useCallback((...args) => {
    if (developerModeRef.current) {
      console.log(...args);
    }
  }, []);

  const debugError = useCallback((...args) => {
    if (developerModeRef.current) {
      console.error(...args);
    }
  }, []);

  useEffect(() => {
    workspacePathRef.current = workspacePath;
  }, [workspacePath]);

  useEffect(() => {
    serverConfigRef.current = serverConfig;
  }, [serverConfig]);

  const getAuthHeader = useCallback(() => {
    const cfg = serverConfigRef.current;
    if (!cfg.password) return null;
    const credentials = btoa(`${cfg.username}:${cfg.password}`);
    return `Basic ${credentials}`;
  }, []);

  const getWorkspaceDir = useCallback(() => {
    let dir = workspacePathRef.current;
    if (!dir) return "";
    return dir;
  }, []);

  const apiRequest = useCallback((path, options = {}) => {
    return new Promise((resolve, reject) => {
      const id = ++messageApiIdRef.current;
      const cfg = serverConfigRef.current;
      const msg = {
        type: "api-request",
        id,
        path,
        options,
        auth: getAuthHeader(),
        serverUrl: cfg.url,
        devMode: developerModeRef.current,
      };
      portRef.current.postMessage(msg);
      callbacksRef.current[id] = { resolve, reject };
    });
  }, [getAuthHeader]);

  const checkHealth = useCallback(() => {
    if (portRef.current) {
      const cfg = serverConfigRef.current;
      portRef.current.postMessage({
        type: "health-check",
        auth: getAuthHeader(),
        serverUrl: cfg.url,
      });
    }
  }, [getAuthHeader]);

  const connectPort = useCallback(() => {
    const port = browser.runtime.connect({ name: "opencode-sidebar" });
    portRef.current = port;

    port.onMessage.addListener((msg) => {
      switch (msg.type) {
        case "health-ok":
          setStatus("connected");
          setStatusText(`OpenCode ${msg.data.version || ""}`);
          break;
        case "health-fail":
          setSessions([]);
          setActiveSession(null);
          setStatus("disconnected");
          setStatusText("Not connected");
          break;
        case "api-response": {
          const cb = callbacksRef.current[msg.id];
          if (cb) {
            debug("[sidebar] api-response:", msg.id, JSON.stringify(msg.data).substring(0, 200));
            cb.resolve(msg.data);
            delete callbacksRef.current[msg.id];
          }
          break;
        }
        case "api-error": {
          const cb = callbacksRef.current[msg.id];
          if (cb) {
            debugError("[sidebar] api-error:", msg.id, msg.error);
            cb.reject(new Error(msg.error));
            delete callbacksRef.current[msg.id];
          }
          break;
        }
        case "tabs-list": {
          const tabsList = msg.tabs || [];
          setTabs(tabsList);
          const activeTab = tabsList.find((t) => t.active);
          if (activeTab) {
            setActiveTabId(activeTab.id);
          }
          const knownIds = knownTabIdsRef.current;
          const newTabIds = tabsList.filter((t) => !knownIds.has(t.id)).map((t) => t.id);
          if (newTabIds.length > 0) {
            setSelectedTabs((prev) => {
              const next = new Set(prev);
              newTabIds.forEach((id) => next.add(id));
              return next;
            });
          }
          knownTabIdsRef.current = new Set(tabsList.map((t) => t.id));
          break;
        }
        case "active-tab-changed":
          setActiveTabId(msg.tabId);
          break;
        case "tab-content":
          if (tabContentCallbacksRef.current) {
            tabContentCallbacksRef.current(msg.tabId, msg.content);
          }
          break;
      }
    });

    port.onDisconnect.addListener(() => {
      portRef.current = null;
      setTimeout(() => {
        connectPort();
        checkHealth();
      }, 2000);
    });

    checkHealth();
  }, [checkHealth]);

  const loadServerConfig = useCallback(async () => {
    try {
      const stored = await browser.storage.local.get([
        "serverUrl",
        "serverUsername",
        "serverPassword",
        "workspacePath",
        "recentWorkspaces",
        "workspaceHistorySize",
        "developerMode",
      ]);
      if (stored.serverUrl || stored.serverUsername || stored.serverPassword) {
        setServerConfig({
          url: stored.serverUrl || "http://localhost:4096",
          username: stored.serverUsername || "opencode",
          password: stored.serverPassword || "",
        });
      }
      if (stored.workspacePath) {
        setWorkspacePath(stored.workspacePath);
      }
      if (stored.recentWorkspaces) {
        setRecentWorkspaces(stored.recentWorkspaces);
      }
      if (stored.workspaceHistorySize !== undefined) {
        setWorkspaceHistorySize(stored.workspaceHistorySize);
      }
      if (stored.developerMode !== undefined) {
        setDeveloperMode(stored.developerMode);
      }
    } catch (e) {
      console.warn("Failed to load server config:", e);
    }
  }, []);

  const getWorkspaceKey = useCallback((path) => {
    if (!path) return "__global__";
    return path;
  }, []);

  const loadWorkspaceSessions = useCallback(async (workspacePath) => {
    const key = getWorkspaceKey(workspacePath);
    const storageKey = `workspaceSessions_${key}`;
    try {
      const result = await browser.storage.local.get([storageKey]);
      return result[storageKey] || [];
    } catch (e) {
      console.warn("Failed to load workspace sessions:", e);
      return [];
    }
  }, [getWorkspaceKey]);

  const saveWorkspaceSession = useCallback(async (workspacePath, sessionId) => {
    const key = getWorkspaceKey(workspacePath);
    const storageKey = `workspaceSessions_${key}`;
    try {
      const result = await browser.storage.local.get([storageKey]);
      const existing = result[storageKey] || [];
      if (!existing.includes(sessionId)) {
        await browser.storage.local.set({ [storageKey]: [...existing, sessionId] });
      }
    } catch (e) {
      console.warn("Failed to save workspace session:", e);
    }
  }, [getWorkspaceKey]);

  const removeWorkspaceSession = useCallback(async (workspacePath, sessionId) => {
    const key = getWorkspaceKey(workspacePath);
    const storageKey = `workspaceSessions_${key}`;
    try {
      const result = await browser.storage.local.get([storageKey]);
      const existing = result[storageKey] || [];
      await browser.storage.local.set({ [storageKey]: existing.filter((id) => id !== sessionId) });
    } catch (e) {
      console.warn("Failed to remove workspace session:", e);
    }
  }, [getWorkspaceKey]);

  const loadSessions = useCallback(async () => {
    try {
      const sessionsList = await apiRequest("/session");
      const allSessions = Array.isArray(sessionsList) ? sessionsList : [];
      const workspaceSessionIds = await loadWorkspaceSessions(workspacePathRef.current);
      const filtered = allSessions.filter((s) => workspaceSessionIds.includes(s.id));
      setSessions(filtered);
      return filtered;
    } catch (e) {
      console.error("Failed to load sessions:", e);
      return [];
    }
  }, [apiRequest, loadWorkspaceSessions]);

  const saveSettings = useCallback(async (config) => {
    const urlChanged = config.url && config.url !== serverConfig.url;
    const pathChanged = config.workspacePath !== undefined && config.workspacePath !== workspacePath;

    setServerConfig({
      url: config.url || serverConfig.url,
      username: config.username || serverConfig.username,
      password: config.password !== undefined ? config.password : serverConfig.password,
    });
    if (config.workspacePath !== undefined) {
      setWorkspacePath(config.workspacePath);
    }
    if (config.workspaceHistorySize !== undefined) {
      setWorkspaceHistorySize(config.workspaceHistorySize);
    }
    if (config.developerMode !== undefined) {
      setDeveloperMode(config.developerMode);
    }
    if (urlChanged || pathChanged) {
      setSessions([]);
      setActiveSession(null);
      setMessages([]);
    }
    let updatedRecent = recentWorkspaces;
    if (pathChanged && config.workspacePath) {
      const newPath = config.workspacePath;
      const filtered = recentWorkspaces.filter((p) => p !== newPath);
      updatedRecent = [newPath, ...filtered].slice(0, workspaceHistorySize);
      setRecentWorkspaces(updatedRecent);
    }
    await browser.storage.local.set({
      serverUrl: config.url || serverConfig.url,
      serverUsername: config.username || serverConfig.username,
      serverPassword: config.password !== undefined ? config.password : serverConfig.password,
      workspacePath: config.workspacePath !== undefined ? config.workspacePath : workspacePath,
      recentWorkspaces: updatedRecent,
      workspaceHistorySize: config.workspaceHistorySize !== undefined ? config.workspaceHistorySize : workspaceHistorySize,
      developerMode: config.developerMode !== undefined ? config.developerMode : developerMode,
    });
    setSettingsOpen(false);
    if (urlChanged) {
      setTimeout(checkHealth, 100);
    }
    if (pathChanged) {
      setTimeout(() => loadSessions(), 100);
    }
  }, [checkHealth, serverConfig, workspacePath, loadSessions, recentWorkspaces, workspaceHistorySize, developerMode]);

  const removeRecentWorkspace = useCallback(async (path) => {
    const updated = recentWorkspaces.filter((p) => p !== path);
    setRecentWorkspaces(updated);
    await browser.storage.local.set({ recentWorkspaces: updated });
  }, [recentWorkspaces]);

  const switchSession = useCallback(async (session) => {
    setMessages([]);
    setActiveSession(session);
    try {
      const msgs = await apiRequest(`/session/${session.id}/message`);
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e) {
      console.error("Failed to load messages:", e);
    }
    setSessionsOpen(false);
  }, [apiRequest]);

  const createSession = useCallback(async (title) => {
    try {
      const session = await apiRequest("/session", {
        method: "POST",
        body: JSON.stringify({ title: title || "New Session" }),
      });
      if (session?.id) {
        await saveWorkspaceSession(workspacePathRef.current, session.id);
        await loadSessions();
        await switchSession(session);
        return session;
      }
    } catch (e) {
      console.error("Failed to create session:", e);
    }
    return null;
  }, [apiRequest, loadSessions, switchSession, saveWorkspaceSession]);

  const clearSession = useCallback(async () => {
    if (!activeSession) return;
    try {
      await apiRequest(`/session/${activeSession.id}/abort`, {
        method: "POST",
      });
    } catch (e) {
      // ignore if already idle
    }
    try {
      await apiRequest(`/session/${activeSession.id}`, {
        method: "DELETE",
      });
    } catch (e) {
      console.error("Failed to delete session on server:", e);
    }
    setMessages([]);
    setActiveSession(null);
    await loadSessions();
    const newSession = await createSession("New Session");
    if (!newSession) {
      setActiveSession(null);
      setMessages([]);
    }
  }, [activeSession, apiRequest, loadSessions, createSession]);

  const renameSession = useCallback(async (session, newTitle) => {
    try {
      await apiRequest(`/session/${session.id}`, {
        method: "PATCH",
        body: JSON.stringify({ title: newTitle }),
      });
      setSessions((prev) =>
        prev.map((s) =>
          s.id === session.id ? { ...s, title: newTitle } : s
        )
      );
      setActiveSession((prev) =>
        prev && prev.id === session.id ? { ...prev, title: newTitle } : prev
      );
    } catch (e) {
      console.error("Failed to rename session:", e);
    }
  }, [apiRequest]);

  const ensureDefaultSession = useCallback(async () => {
    if (activeSession) return activeSession;
    try {
      const list = await loadSessions();
      const existing = list.find((s) => s.title === "default");
      if (existing) {
        await switchSession(existing);
        return existing;
      } else {
        const session = await createSession("default");
        return session;
      }
    } catch (e) {
      console.error("Failed to create default session:", e);
      return null;
    }
  }, [activeSession, loadSessions, switchSession, createSession]);

  const loadTabs = useCallback(() => {
    if (portRef.current) {
      portRef.current.postMessage({ type: "get-tabs" });
    }
  }, []);

  const toggleTab = useCallback((tabId, checked) => {
    setSelectedTabs((prev) => {
      const next = new Set(prev);
      if (checked) next.add(tabId);
      else next.delete(tabId);
      return next;
    });
  }, []);

  const extractSelectedTabs = useCallback(async (tabIds, activeTabId) => {
    return new Promise((resolve) => {
      const pending = new Set(tabIds);
      const contents = [];

      tabContentCallbacksRef.current = (tabId, content) => {
        if (content && content.text) {
          contents.push({ ...content, isActive: tabId === activeTabId });
        }
        pending.delete(tabId);
        if (pending.size === 0) {
          resolve(contents);
        }
      };

      for (const tabId of tabIds) {
        try {
          portRef.current.postMessage({
            type: "extract-tab-content",
            tabId,
          });
        } catch (e) {
          pending.delete(tabId);
          if (pending.size === 0) resolve(contents);
        }
      }

      setTimeout(() => resolve(contents), 5000);
    });
  }, []);

  const sendPrompt = useCallback(
    async (text, options = {}) => {
      if (!text || isStreaming) return;

      let session = options.session || activeSession;
      if (!session) {
        session = await ensureDefaultSession();
        if (!session) return;
      }

      setIsStreaming(true);
      
      let contextText = "You are an agent deployed as a Firefox browser extension. You are provided browser tab content as context and can be configured to modify the filesystem with-in a specific directory (workspace). Use markdown formatting. When referencing websites return their url in the response.";
      if (selectedTabs.size > 0) {
        const tabContents = await extractSelectedTabs([...selectedTabs], activeTabId);
        if (tabContents.length > 0) {
          contextText = tabContents
            .map(
              (tc) =>
                tc.isActive
                  ? `[Active Tab: "${tc.title}" (${tc.url})]\n${tc.text}`
                  : `[Context: Tab "${tc.title}" (${tc.url})]\n${tc.text}`
            )
            .join("\n\n");
        }
      }

      if (workspacePathRef.current) {
        const wp = getWorkspaceDir();
        const projectContext = `Use ${wp} as the current working directory from now on. All created files and references to files should be relative to ${wp} unless explicity told to do otherwise`;
        contextText = `${contextText}\n\n${projectContext}`;
      }

      const userMsg = {
        role: "user",
        parts: [{ type: "text", text }],
        context: contextText,
      };
      setMessages((prev) => [...prev, userMsg]);

      try {
        const body = { parts: [{ type: "text", text }] };
        if (contextText) body.system = contextText;

        const fetchHeaders = { "Content-Type": "application/json" };
        const auth = getAuthHeader();
        if (auth) fetchHeaders.Authorization = auth;

        const response = await fetch(
          `${serverConfig.url}/session/${session.id}/message`,
          {
            method: "POST",
            headers: fetchHeaders,
            body: JSON.stringify(body),
          }
        );

        if (response.ok) {
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("text/event-stream")) {
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";
            let assistantText = "";
            let modelID = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";

              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const data = line.slice(6);
                  if (data === "[DONE]") continue;
                  try {
                    const parsed = JSON.parse(data);
                    if (parsed.data?.modelID) {
                      modelID = parsed.data.modelID;
                    }
                    if (parsed.type === "chunk" && parsed.data?.parts) {
                      for (const part of parsed.data.parts) {
                        if (part.type === "text" && part.text) {
                          assistantText += part.text;
                          setMessages((prev) => {
                            const next = [...prev];
                            const lastIdx = next.length - 1;
                            const last = next[lastIdx];
                            if (last?.role === "assistant") {
                              next[lastIdx] = {
                                ...last,
                                parts: [{ type: "text", text: assistantText }],
                              };
                            } else {
                              next.push({
                                role: "assistant",
                                parts: [{ type: "text", text: assistantText }],
                              });
                            }
                            return next;
                          });
                        }
                      }
                    }
                  } catch (e) {
                    // skip non-JSON data lines
                  }
                }
              }
            }

            if (modelID) {
              setMessages((prev) => {
                const next = [...prev];
                const lastIdx = next.length - 1;
                const last = next[lastIdx];
                if (last?.role === "assistant") {
                  next[lastIdx] = {
                    ...last,
                    info: { ...last.info, modelID, role: "assistant" },
                  };
                }
                return next;
              });
            }
          } else {
            const data = await response.json();
            setMessages((prev) => [...prev, data]);
          }
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              parts: [
                {
                  type: "text",
                  text: `Failed to get response (${response.status})`,
                },
              ],
              error: true,
            },
          ]);
        }
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            parts: [{ type: "text", text: `Error: ${e.message}` }],
            error: true,
          },
        ]);
      } finally {
        setIsStreaming(false);
      }
    },
    [
      isStreaming,
      activeSession,
      ensureDefaultSession,
      selectedTabs,
      activeTabId,
      extractSelectedTabs,
      getAuthHeader,
      getWorkspaceDir,
      serverConfig.url,
    ]
  );

  useEffect(() => {
    loadServerConfig();
    connectPort();
  }, [loadServerConfig, connectPort]);

  useEffect(() => {
    if (status === "connected") {
      ensureDefaultSession();
      loadTabs();
    }
  }, [status]);

  useEffect(() => {
    if (sessions.length > 0 && !activeSession) {
      const existing = sessions.find((s) => s.title === "default");
      if (existing) {
        switchSession(existing);
      } else {
        switchSession(sessions[0]);
      }
    }
  }, [sessions, activeSession, switchSession]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (portRef.current) {
        const cfg = serverConfigRef.current;
        portRef.current.postMessage({
          type: "health-check",
          auth: getAuthHeader(),
          serverUrl: cfg.url,
        });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [getAuthHeader]);

  const { workingStatus, pendingPermission, setPendingPermission, pendingQuestion, setPendingQuestion } = useEvents(
    serverConfig.url,
    getAuthHeader,
    activeSession?.id || null
  );

  const respondToPermission = useCallback(async (permissionId, response) => {
    if (!activeSession) return;
    try {
      await apiRequest(`/session/${activeSession.id}/permissions/${permissionId}`, {
        method: "POST",
        body: JSON.stringify({ response }),
      });
      setPendingPermission(null);
    } catch (e) {
      console.error("Failed to respond to permission:", e);
    }
  }, [activeSession, apiRequest, setPendingPermission]);

  const answerQuestion = useCallback(async (questionId, answers, context) => {
    if (!activeSession) return;
    try {
      debug("answerQuestion:", { questionId, answers, sessionId: activeSession.id });
      const result = await apiRequest(`/question/${questionId}/reply`, {
        method: "POST",
        body: JSON.stringify({ answers }),
      });
      debug("answerQuestion response:", result);
      if (context?.answer) {
        const text = context.header
          ? `${context.header}\n${context.question}\n\n→ ${context.answer}${context.description ? ` — ${context.description}` : ""}`
          : `${context.question}\n\n→ ${context.answer}${context.description ? ` — ${context.description}` : ""}`;
        setMessages((prev) => [
          ...prev,
          {
            role: "user",
            parts: [{ type: "text", text }],
          },
        ]);
      }
      setPendingQuestion(null);
    } catch (e) {
      debugError("Failed to answer question:", e);
    }
  }, [activeSession, apiRequest, setPendingQuestion, setMessages, debug, debugError]);

  const abortSession = useCallback(async () => {
    if (!activeSession) return;
    try {
      await apiRequest(`/session/${activeSession.id}/abort`, {
        method: "POST",
      });
      setIsStreaming(false);
    } catch (e) {
      console.error("Failed to abort session:", e);
    }
  }, [activeSession, apiRequest]);

  const workspaceName = workspacePath ? workspacePath.split("/").pop() || workspacePath : "";

  return {
    status,
    statusText,
    messages,
    tabs,
    selectedTabs,
    activeTabId,
    sessions,
    activeSession,
    sessionsOpen,
    serverConfig,
    workspacePath,
    workspaceName,
    workspaceOpen,
    setWorkspaceOpen,
    recentWorkspaces,
    workspaceHistorySize,
    removeRecentWorkspace,
    developerMode,
    settingsOpen,
    tabsOpen,
    isStreaming,
    setSettingsOpen,
    setTabsOpen,
    setSessionsOpen,
    getAuthHeader,
    apiRequest,
    checkHealth,
    loadServerConfig,
    saveSettings,
    loadSessions,
    switchSession,
    clearSession,
    createSession,
    renameSession,
    ensureDefaultSession,
    loadTabs,
    toggleTab,
    sendPrompt,
    workingStatus,
    pendingPermission,
    respondToPermission,
    pendingQuestion,
    answerQuestion,
    abortSession,
    marked,
  };
}
