import { render, screen, fireEvent } from "@testing-library/react";
import Header from "../sidebar/components/Header";

describe("Header", () => {
  it("renders connection status", () => {
    render(
      <Header
        status="connected"
        statusText="OpenCode 1.0.0"
        onSettingsClick={() => {}}
        onClearSession={() => {}}
      />
    );
    expect(screen.getByText("OpenCode 1.0.0")).toBeInTheDocument();
  });

  it("shows disconnected status", () => {
    render(
      <Header
        status="disconnected"
        statusText="Not connected"
        onSettingsClick={() => {}}
        onClearSession={() => {}}
      />
    );
    expect(screen.getByText("Not connected")).toBeInTheDocument();
  });

  it("renders clear session button when developer mode is enabled", () => {
    const onClear = vi.fn();
    render(
      <Header
        status="connected"
        statusText="OpenCode 1.0.0"
        onSettingsClick={() => {}}
        onClearSession={onClear}
        developerMode={true}
      />
    );
    const btn = screen.getByText("Clear Session");
    expect(btn).toBeInTheDocument();
    fireEvent.click(btn);
    expect(onClear).toHaveBeenCalled();
  });

  it("hides clear session button when developer mode is disabled", () => {
    render(
      <Header
        status="connected"
        statusText="OpenCode 1.0.0"
        onSettingsClick={() => {}}
        onClearSession={() => {}}
        developerMode={false}
      />
    );
    expect(screen.queryByText("Clear Session")).not.toBeInTheDocument();
  });

  it("renders settings button", () => {
    const onSettings = vi.fn();
    render(
      <Header
        status="connected"
        statusText="OpenCode 1.0.0"
        onSettingsClick={onSettings}
        onClearSession={() => {}}
      />
    );
    const btn = screen.getByTitle("Settings");
    fireEvent.click(btn);
    expect(onSettings).toHaveBeenCalled();
  });
});
