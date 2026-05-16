import { useOpenCode } from "./hooks/useOpenCode";
import Header from "./components/Header";
import MessagesList from "./components/MessagesList";
import InputArea from "./components/InputArea";
import TabContextPanel from "./components/TabContextPanel";
import WorkspacePanel from "./components/WorkspacePanel";
import SettingsPanel from "./components/SettingsPanel";

export default function App() {
  const {
    status,
    statusText,
    messages,
    tabs,
    selectedTabs,
    activeTabId,
    settingsOpen,
    tabsOpen,
    workspaceOpen,
    isStreaming,
    setSettingsOpen,
    setTabsOpen,
    setWorkspaceOpen,
    loadTabs,
    toggleTab,
    clearSelectedTabs,
    sendPrompt,
    workingStatus,
    pendingPermission,
    respondToPermission,
    pendingQuestion,
    answerQuestion,
    abortSession,
    marked,
    clearSession,
    workspaceName,
    workspacePath,
    recentWorkspaces,
    workspaceHistorySize,
    removeRecentWorkspace,
    developerMode,
    serverConfig,
    saveSettings,
  } = useOpenCode();

  const connected = status === "connected";

  const handleTabsClick = () => {
    setTabsOpen(!tabsOpen);
    setWorkspaceOpen(false);
    setSettingsOpen(false);
  };

  const handleWorkspaceClick = () => {
    setWorkspaceOpen(!workspaceOpen);
    setTabsOpen(false);
    setSettingsOpen(false);
  };

  const handleSettingsClick = () => {
    setSettingsOpen(!settingsOpen);
    setTabsOpen(false);
    setWorkspaceOpen(false);
  };

  const handleSend = (text: string) => {
    sendPrompt(text);
  };

  return (
    <div id="app">
      <Header
        status={status}
        statusText={statusText}
        onSettingsClick={handleSettingsClick}
        onClearSession={clearSession}
        developerMode={developerMode}
      />
      {workspaceName && (
        <div id="workspace-subheader">
          Workspace: <span>{workspaceName}</span>
        </div>
      )}
      <MessagesList messages={messages} marked={marked} workingStatus={workingStatus} pendingPermission={pendingPermission} respondToPermission={respondToPermission} pendingQuestion={pendingQuestion} answerQuestion={answerQuestion} abortSession={abortSession} developerMode={developerMode} />
      <WorkspacePanel
        open={workspaceOpen}
        workspacePath={workspacePath}
        onSet={(path) => saveSettings({ ...serverConfig, workspacePath: path })}
        onClose={() => setWorkspaceOpen(false)}
        recentWorkspaces={recentWorkspaces}
        onRemoveRecent={removeRecentWorkspace}
      />
      <TabContextPanel
        open={tabsOpen}
        tabs={tabs}
        selectedTabs={selectedTabs}
        activeTabId={activeTabId}
        onToggleTab={toggleTab}
        onRefresh={loadTabs}
        onDeselectAll={clearSelectedTabs}
      />
      <InputArea
        onSend={handleSend}
        disabled={!connected}
        isStreaming={isStreaming}
        selectedTabsCount={selectedTabs.size}
        onTabsClick={handleTabsClick}
        tabsOpen={tabsOpen}
        onWorkspaceClick={handleWorkspaceClick}
        workspaceOpen={workspaceOpen}
        workspaceName={workspaceName}
      />
      <SettingsPanel
        open={settingsOpen}
        serverConfig={serverConfig}
        workspaceHistorySize={workspaceHistorySize}
        developerMode={developerMode}
        onSave={saveSettings}
      />
    </div>
  );
}
