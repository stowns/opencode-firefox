import { useState, useEffect, useRef, useCallback } from "react";
import { marked } from "marked";
import { sidebarDebug, enableDebug, disableDebug } from "../../debug";
import type { SidebarToBackground, BackgroundToSidebar } from "../../shared/protocol";
import {
  MSG_HEALTH_CHECK,
  MSG_API_REQUEST,
  MSG_GET_TABS,
  MSG_EXTRACT_TAB_CONTENT,
  MSG_SUBSCRIBE_EVENTS,
  MSG_UNSUBSCRIBE_EVENTS,
  MSG_SEND_PROMPT,
  MSG_ABORT_PROMPT,
  MSG_SET_DEVELOPER_MODE,
  MSG_HEALTH_OK,
  MSG_HEALTH_FAIL,
  MSG_API_RESPONSE,
  MSG_API_ERROR,
  MSG_TABS_LIST,
  MSG_TABS_ERROR,
  MSG_ACTIVE_TAB_CHANGED,
  MSG_TAB_CONTENT,
  MSG_TAB_CONTENT_ERROR,
  MSG_EVENT,
  MSG_PROMPT_CHUNK,
  MSG_PROMPT_DONE,
  MSG_PROMPT_ERROR,
} from "../../shared/protocol";

marked.setOptions({ breaks: true, gfm: true });

interface ServerConfig {
  url: string;
  username: string;
  password: string;
}

interface Message {
  role?: string;
  parts?: Array<{ type: string; text?: string }>;
  context?: string;
  error?: boolean;
  info?: {
    role?: string;
    modelID?: string;
  };
}

interface Session {
  id: string;
  title: string;
}

interface Tab {
  id: number;
  title?: string;
  url?: string;
  active?: boolean;
}

interface WorkingStatus {
  type: string;
  text: string;
}

interface PendingPermission {
  id: string;
  sessionID?: string;
  messageID?: string;
  callID?: string;
  type?: string;
  title?: string;
  patterns?: string[];
  metadata?: Record<string, unknown>;
}

interface PendingQuestion {
  id: string;
  sessionID?: string;
  messageID?: string;
  callID?: string;
  questions: Array<{
    question?: string;
    header?: string;
    options?: Array<{
      label: string;
      description?: string;
    }>;
  }>;
}

interface EventPayload {
  type: string;
  properties?: Record<string, unknown>;
}

interface EventData {
  payload?: EventPayload;
}

export function useOpenCode() {
  const portRef = useRef<browser.runtime.Port | null>(null);
  const callbacksRef = useRef<Record<number, { resolve: (value: unknown) => void; reject: (reason: Error) => void }>>({});
  const tabContentCallbacksRef = useRef<((tabId: number, content: { title: string; url: string; text: string }) => void) | null>(null);
  const messageApiIdRef = useRef(0);
  const knownTabIdsRef = useRef(new Set<number>());
  const promptIdRef = useRef(0);
  const assistantTextRef = useRef("");
  const promptModelIdRef = useRef("");

  const [status, setStatus] = useState("connecting");
  const [statusText, setStatusText] = useState("Connecting...");
  const [messages, setMessages] = useState<Message[]>([]);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [selectedTabs, setSelectedTabs] = useState<Set<number>>(new Set());
  const [activeTabId, setActiveTabId] = useState<number | null>(null);
  const [serverConfig, setServerConfig] = useState<ServerConfig>({
    url: "http://localhost:4096",
    username: "opencode",
    password: "",
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [tabsOpen, setTabsOpen] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeSession, setActiveSession] = useState<Session | null>(null);
  const [sessionsOpen, setSessionsOpen] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [workspacePath, setWorkspacePath] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const [recentWorkspaces, setRecentWorkspaces] = useState<string[]>([]);
  const [workspaceHistorySize, setWorkspaceHistorySize] = useState(5);
  const [developerMode, setDeveloperMode] = useState(false);
  const [workingStatus, setWorkingStatus] = useState<WorkingStatus | null>(null);
  const [pendingPermission, setPendingPermission] = useState<PendingPermission | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const workspacePathRef = useRef(workspacePath);
  const serverConfigRef = useRef(serverConfig);
  const developerModeRef = useRef(developerMode);
  const activeSessionIdRef = useRef<string | null>(null);

  useEffect(() => {
    developerModeRef.current = developerMode;
    if (developerMode) {
      enableDebug();
    } else {
      disableDebug();
    }
    portRef.current?.postMessage({ type: MSG_SET_DEVELOPER_MODE, enabled: developerMode });
  }, [developerMode]);

  const debug = useCallback((...args: unknown[]) => {
    if (developerModeRef.current) {
      sidebarDebug(...args);
    }
  }, []);

  const debugError = useCallback((...args: unknown[]) => {
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

  useEffect(() => {
    activeSessionIdRef.current = activeSession?.id || null;
  }, [activeSession]);

  const getAuthHeader = useCallback((): string | null => {
    const cfg = serverConfigRef.current;
    if (!cfg.password) return null;
    const credentials = btoa(`${cfg.username}:${cfg.password}`);
    return `Basic ${credentials}`;
  }, []);

  const getWorkspaceDir = useCallback((): string => {
    let dir = workspacePathRef.current;
    if (!dir) return "";
    return dir;
  }, []);

  const apiRequest = useCallback((path: string, options: RequestInit = {}): Promise<unknown> => {
    return new Promise((resolve, reject) => {
      const id = ++messageApiIdRef.current;
      const cfg = serverConfigRef.current;
      portRef.current?.postMessage({
        type: MSG_API_REQUEST,
        id,
        path,
        options,
        auth: getAuthHeader(),
        serverUrl: cfg.url,
      });
      callbacksRef.current[id] = { resolve, reject };
    });
  }, [getAuthHeader]);

  const checkHealth = useCallback(() => {
    if (portRef.current) {
      const cfg = serverConfigRef.current;
      portRef.current.postMessage({
        type: MSG_HEALTH_CHECK,
        auth: getAuthHeader(),
        serverUrl: cfg.url,
      });
    }
  }, [getAuthHeader]);

  const handleSSEEvent = useCallback((event: EventData) => {
    const payload = event.payload;
    if (!payload) return;

    const type = payload.type;
    const props = payload.properties || {};

    const currentSessionId = activeSessionIdRef.current;
    if (!currentSessionId) return;

    const sessionId = props.sessionID as string | undefined;
    if (sessionId && sessionId !== currentSessionId) return;

    switch (type) {
      case "session.status": {
        const statusType = (props.status as { type?: string })?.type;
        if (statusType === "busy" || statusType === "retry") {
          setWorkingStatus({ type: "thinking", text: "Thinking..." });
        }
        break;
      }

      case "session.idle":
        setWorkingStatus(null);
        setIsStreaming(false);
        break;

      case "message.updated": {
        const info = props.info as { modelID?: string } | undefined;
        if (info?.modelID) {
          setMessages((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            const last = next[lastIdx];
            if (last?.role === "assistant") {
              next[lastIdx] = {
                ...last,
                info: { ...last.info, modelID: info.modelID, role: "assistant" },
              };
            }
            return next;
          });
        }
        break;
      }

      case "message.part.updated": {
        const part = props.part as { type?: string; state?: string; name?: string; input?: Record<string, string>; text?: string } | undefined;
        if (part?.type === "text" && part.text) {
          assistantTextRef.current = part.text;
          setMessages((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            const last = next[lastIdx];
            if (last?.role === "assistant") {
              next[lastIdx] = {
                ...last,
                parts: [{ type: "text", text: part.text }],
              };
            } else {
              next.push({
                role: "assistant",
                parts: [{ type: "text", text: part.text }],
              });
            }
            return next;
          });
        }
        if (part?.type === "tool" && part.state === "running") {
          const toolName = part.name || "";
          const input = part.input || {};
          if (toolName === "bash" || toolName === "exec") {
            const cmd = input.command || "";
            setWorkingStatus({
              type: "running",
              text: `Running: ${cmd.slice(0, 80)}${cmd.length > 80 ? "..." : ""}`,
            });
          } else if (toolName === "write" || toolName === "edit") {
            const filePath = input.path || input.file || "";
            setWorkingStatus({
              type: "editing",
              text: `Editing: ${filePath}`,
            });
          } else if (toolName === "glob" || toolName === "grep") {
            setWorkingStatus({
              type: "searching",
              text: `Searching files...`,
            });
          } else if (toolName === "read") {
            const filePath = input.path || input.file || "";
            setWorkingStatus({
              type: "reading",
              text: `Reading: ${filePath}`,
            });
          } else {
            setWorkingStatus({
              type: "tool",
              text: `Using ${toolName}...`,
            });
          }
        }
        break;
      }

      case "file.edited": {
        const filePath = props.file as string | undefined;
        if (filePath) {
          setWorkingStatus({
            type: "editing",
            text: `Editing: ${filePath}`,
          });
        }
        break;
      }

      case "todo.updated": {
        const todos = (props.todos as Array<{ status?: string; content?: string }>) || [];
        const active = todos.find((t) => t.status === "pending" || t.status === "in_progress");
        if (active) {
          setWorkingStatus({
            type: "todo",
            text: active.content || "Working...",
          });
        }
        break;
      }

      case "session.compacted":
        setWorkingStatus({ type: "thinking", text: "Compacting context..." });
        break;

      case "question.replied":
        setPendingQuestion(null);
        break;

      case "question.rejected":
        setPendingQuestion(null);
        break;

      case "permission.asked":
        setPendingPermission({
          id: props.id as string,
          sessionID: props.sessionID as string,
          messageID: (props.tool as { messageID?: string })?.messageID,
          callID: (props.tool as { callID?: string })?.callID,
          type: props.permission as string,
          title: props.permission as string,
          patterns: props.patterns as string[] | undefined,
          metadata: props.metadata as Record<string, unknown> | undefined,
        });
        break;

      case "permission.replied":
        setPendingPermission(null);
        break;

      case "question.asked":
        setPendingQuestion({
          id: props.id as string,
          sessionID: props.sessionID as string,
          messageID: (props.tool as { messageID?: string })?.messageID,
          callID: (props.tool as { callID?: string })?.callID,
          questions: (props.questions as PendingQuestion["questions"]) || [],
        });
        break;
    }
  }, []);

  const connectPort = useCallback(() => {
    const port = browser.runtime.connect({ name: "opencode-sidebar" });
    portRef.current = port;

    port.onMessage.addListener((msg: BackgroundToSidebar) => {
      switch (msg.type) {
        case MSG_HEALTH_OK:
          setStatus("connected");
          setStatusText(`OpenCode ${(msg.data as Record<string, string>)?.version || ""}`);
          break;
        case MSG_HEALTH_FAIL:
          setSessions([]);
          setActiveSession(null);
          setStatus("disconnected");
          setStatusText("Not connected");
          break;
        case MSG_API_RESPONSE: {
          const cb = callbacksRef.current[msg.id as number];
          if (cb) {
            debug("[sidebar] api-response:", msg.id, JSON.stringify(msg.data).substring(0, 200));
            cb.resolve(msg.data as unknown);
            delete callbacksRef.current[msg.id as number];
          }
          break;
        }
        case MSG_API_ERROR: {
          const cb = callbacksRef.current[msg.id as number];
          if (cb) {
            debugError("[sidebar] api-error:", msg.id, msg.error);
            cb.reject(new Error(msg.error as string));
            delete callbacksRef.current[msg.id as number];
          }
          break;
        }
        case MSG_TABS_LIST: {
          const tabsList = (msg.tabs as Tab[]) || [];
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
        case MSG_ACTIVE_TAB_CHANGED:
          setActiveTabId(msg.tabId as number);
          break;
        case MSG_TAB_CONTENT:
          if (tabContentCallbacksRef.current) {
            tabContentCallbacksRef.current(msg.tabId as number, msg.content as { title: string; url: string; text: string });
          }
          break;
        case MSG_EVENT:
          handleSSEEvent(msg.event as EventData);
          break;
        case MSG_PROMPT_CHUNK: {
          const chunk = msg.chunk as string;
          assistantTextRef.current += chunk;
          setMessages((prev) => {
            const next = [...prev];
            const lastIdx = next.length - 1;
            const last = next[lastIdx];
            if (last?.role === "assistant") {
              next[lastIdx] = {
                ...last,
                parts: [{ type: "text", text: assistantTextRef.current }],
              };
            } else {
              next.push({
                role: "assistant",
                parts: [{ type: "text", text: assistantTextRef.current }],
              });
            }
            return next;
          });
          break;
        }
        case MSG_PROMPT_DONE: {
          const modelID = msg.modelID as string;
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
          setIsStreaming(false);
          break;
        }
        case MSG_PROMPT_ERROR: {
          setMessages((prev) => [
            ...prev,
            {
              role: "assistant",
              parts: [{ type: "text", text: `Error: ${msg.error}` }],
              error: true,
            },
          ]);
          setIsStreaming(false);
          break;
        }
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
  }, [checkHealth, debug, debugError, handleSSEEvent]);

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

  const getWorkspaceKey = useCallback((path: string): string => {
    if (!path) return "__global__";
    return path;
  }, []);

  const loadWorkspaceSessions = useCallback(async (wp: string): Promise<string[]> => {
    const key = getWorkspaceKey(wp);
    const storageKey = `workspaceSessions_${key}`;
    try {
      const result = await browser.storage.local.get([storageKey]);
      return (result[storageKey] as string[]) || [];
    } catch (e) {
      console.warn("Failed to load workspace sessions:", e);
      return [];
    }
  }, [getWorkspaceKey]);

  const saveWorkspaceSession = useCallback(async (wp: string, sessionId: string) => {
    const key = getWorkspaceKey(wp);
    const storageKey = `workspaceSessions_${key}`;
    try {
      const result = await browser.storage.local.get([storageKey]);
      const existing = (result[storageKey] as string[]) || [];
      if (!existing.includes(sessionId)) {
        await browser.storage.local.set({ [storageKey]: [...existing, sessionId] });
      }
    } catch (e) {
      console.warn("Failed to save workspace session:", e);
    }
  }, [getWorkspaceKey]);

  const removeWorkspaceSession = useCallback(async (wp: string, sessionId: string) => {
    const key = getWorkspaceKey(wp);
    const storageKey = `workspaceSessions_${key}`;
    try {
      const result = await browser.storage.local.get([storageKey]);
      const existing = (result[storageKey] as string[]) || [];
      await browser.storage.local.set({ [storageKey]: existing.filter((id) => id !== sessionId) });
    } catch (e) {
      console.warn("Failed to remove workspace session:", e);
    }
  }, [getWorkspaceKey]);

  const loadSessions = useCallback(async (): Promise<Session[]> => {
    try {
      const sessionsList = await apiRequest("/session") as Session[];
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

  const saveSettings = useCallback(async (config: Partial<ServerConfig> & { workspacePath?: string; workspaceHistorySize?: number; developerMode?: boolean }) => {
    const urlChanged = !!config.url && config.url !== serverConfig.url;
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

  const removeRecentWorkspace = useCallback(async (path: string) => {
    const updated = recentWorkspaces.filter((p) => p !== path);
    setRecentWorkspaces(updated);
    await browser.storage.local.set({ recentWorkspaces: updated });
  }, [recentWorkspaces]);

  const switchSession = useCallback(async (session: Session) => {
    setMessages([]);
    setActiveSession(session);
    try {
      const msgs = await apiRequest(`/session/${session.id}/message`) as Message[];
      setMessages(Array.isArray(msgs) ? msgs : []);
    } catch (e) {
      console.error("Failed to load messages:", e);
    }
    setSessionsOpen(false);
  }, [apiRequest]);

  const createSession = useCallback(async (title: string): Promise<Session | null> => {
    try {
      const session = await apiRequest("/session", {
        method: "POST",
        body: JSON.stringify({ title: title || "New Session" }),
      }) as Session;
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

  const renameSession = useCallback(async (session: Session, newTitle: string) => {
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

  const ensureDefaultSession = useCallback(async (): Promise<Session | null> => {
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
      portRef.current.postMessage({ type: MSG_GET_TABS });
    }
  }, []);

  const toggleTab = useCallback((tabId: number, checked: boolean) => {
    setSelectedTabs((prev) => {
      const next = new Set(prev);
      if (checked) next.add(tabId);
      else next.delete(tabId);
      return next;
    });
  }, []);

  const extractSelectedTabs = useCallback(async (tabIds: number[], activeTabId: number) => {
    return new Promise<Array<{ title: string; url: string; text: string; isActive: boolean }>>((resolve) => {
      const pending = new Set(tabIds);
      const contents: Array<{ title: string; url: string; text: string; isActive: boolean }> = [];

      tabContentCallbacksRef.current = (tId: number, content: { title: string; url: string; text: string }) => {
        if (content && content.text) {
          contents.push({ ...content, isActive: tId === activeTabId });
        }
        pending.delete(tId);
        if (pending.size === 0) {
          resolve(contents);
        }
      };

      for (const tId of tabIds) {
        try {
          portRef.current?.postMessage({ type: MSG_EXTRACT_TAB_CONTENT, tabId: tId });
        } catch {
          pending.delete(tId);
          if (pending.size === 0) resolve(contents);
        }
      }

      setTimeout(() => resolve(contents), 5000);
    });
  }, []);

  const sendPrompt = useCallback(
    async (text: string, options: { session?: Session } = {}) => {
      if (!text || isStreaming) return;

      let session = options.session || activeSession;
      if (!session) {
        session = await ensureDefaultSession();
        if (!session) return;
      }

      setIsStreaming(true);
      assistantTextRef.current = "";
      promptModelIdRef.current = "";

      let contextText = "You are an agent deployed as a Firefox browser extension. You are provided browser tab content as context and can be configured to modify the filesystem with-in a specific directory (workspace). Use markdown formatting. When referencing websites return their url in the response.";
      if (selectedTabs.size > 0) {
        const tabContents = await extractSelectedTabs([...selectedTabs], activeTabId!);
        if (tabContents.length > 0) {
          contextText = tabContents
            .map(
              (tc) =>
                tc.isActive
                  ? `[Active Tab (The user can see the content of this tab) "${tc.title}" (${tc.url})]\n${tc.text}]`
                  : `[Tab (The user cannot see the content of this tab) "${tc.title}" (${tc.url})]\n${tc.text}]`
            )
            .join("\n\n");
        }
      }

      if (workspacePathRef.current) {
        const wp = getWorkspaceDir();
        const projectContext = `Use ${wp} as the current working directory from now on. ${wp} is your current directory and current workspace. All created files and references to files should be relative to ${wp} unless explicity told to do otherwise`;
        contextText = `${contextText}\n\n${projectContext}`;
      }

      const userMsg: Message = {
        role: "user",
        parts: [{ type: "text", text }],
        context: contextText,
      };
      setMessages((prev) => [...prev, userMsg]);

      const id = ++promptIdRef.current;
      const cfg = serverConfigRef.current;
      const auth = getAuthHeader();
      const fetchHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (auth) fetchHeaders.Authorization = auth;

      const body: Record<string, unknown> = { parts: [{ type: "text", text }] };
      if (contextText) body.system = contextText;

      portRef.current?.postMessage({
        type: MSG_SEND_PROMPT,
        id,
        serverUrl: cfg.url,
        auth: auth || undefined,
        sessionId: session.id,
        text,
        body,
        system: contextText || undefined,
      });
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
    ]
  );

  const subscribeEvents = useCallback((sessionId: string) => {
    if (portRef.current) {
      portRef.current.postMessage({ type: MSG_SUBSCRIBE_EVENTS, sessionId });
    }
  }, []);

  const unsubscribeEvents = useCallback(() => {
    if (portRef.current) {
      portRef.current.postMessage({ type: MSG_UNSUBSCRIBE_EVENTS });
    }
  }, []);

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
          type: MSG_HEALTH_CHECK,
          auth: getAuthHeader(),
          serverUrl: cfg.url,
        });
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [getAuthHeader]);

  useEffect(() => {
    if (activeSession?.id) {
      subscribeEvents(activeSession.id);
    } else {
      unsubscribeEvents();
    }
    return () => {
      unsubscribeEvents();
    };
  }, [activeSession?.id, subscribeEvents, unsubscribeEvents]);

  const respondToPermission = useCallback(async (permissionId: string, response: string) => {
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

  const answerQuestion = useCallback(async (questionId: string, answers: string[][], context?: { header?: string; question?: string; answer?: string; description?: string }) => {
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
      portRef.current?.postMessage({ type: MSG_ABORT_PROMPT });
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
    clearSession,
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
    saveSettings,
    debug,
  };
}
