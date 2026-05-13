import { render, screen, fireEvent } from "@testing-library/react";
import WorkspacePanel from "../sidebar/components/WorkspacePanel";

describe("WorkspacePanel", () => {
  it("renders when open", () => {
    render(
      <WorkspacePanel
        open={true}
        workspacePath=""
        onSet={() => {}}
        onClose={() => {}}
        recentWorkspaces={[]}
        onRemoveRecent={() => {}}
      />
    );
    expect(screen.getByText("Workspace")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(
      <WorkspacePanel
        open={false}
        workspacePath=""
        onSet={() => {}}
        onClose={() => {}}
        recentWorkspaces={[]}
        onRemoveRecent={() => {}}
      />
    );
    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
  });

  it("sets workspace path on button click", () => {
    const onSet = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkspacePanel
        open={true}
        workspacePath=""
        onSet={onSet}
        onClose={onClose}
        recentWorkspaces={[]}
        onRemoveRecent={() => {}}
      />
    );
    const input = screen.getByPlaceholderText("~/projects/my-app");
    fireEvent.change(input, { target: { value: "~/my-project" } });
    fireEvent.click(screen.getByText("Set"));
    expect(onSet).toHaveBeenCalledWith("~/my-project");
    expect(onClose).toHaveBeenCalled();
  });

  it("clears workspace on clear button click", () => {
    const onSet = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkspacePanel
        open={true}
        workspacePath="~/existing-project"
        onSet={onSet}
        onClose={onClose}
        recentWorkspaces={[]}
        onRemoveRecent={() => {}}
      />
    );
    fireEvent.click(screen.getByText("Clear workspace"));
    expect(onSet).toHaveBeenCalledWith("");
    expect(onClose).toHaveBeenCalled();
  });

  it("shows recent workspaces", () => {
    const onSet = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkspacePanel
        open={true}
        workspacePath=""
        onSet={onSet}
        onClose={onClose}
        recentWorkspaces={["~/proj-a", "~/proj-b"]}
        onRemoveRecent={() => {}}
      />
    );
    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(screen.getByText("~/proj-a")).toBeInTheDocument();
    expect(screen.getByText("~/proj-b")).toBeInTheDocument();
  });

  it("selects recent workspace on click", () => {
    const onSet = vi.fn();
    const onClose = vi.fn();
    render(
      <WorkspacePanel
        open={true}
        workspacePath=""
        onSet={onSet}
        onClose={onClose}
        recentWorkspaces={["~/proj-a"]}
        onRemoveRecent={() => {}}
      />
    );
    fireEvent.click(screen.getByText("~/proj-a"));
    expect(onSet).toHaveBeenCalledWith("~/proj-a");
    expect(onClose).toHaveBeenCalled();
  });

  it("removes recent workspace on x click", () => {
    const onRemove = vi.fn();
    render(
      <WorkspacePanel
        open={true}
        workspacePath=""
        onSet={() => {}}
        onClose={() => {}}
        recentWorkspaces={["~/proj-a"]}
        onRemoveRecent={onRemove}
      />
    );
    fireEvent.click(screen.getByText("×"));
    expect(onRemove).toHaveBeenCalledWith("~/proj-a");
  });

  it("excludes current workspace from recent list", () => {
    render(
      <WorkspacePanel
        open={true}
        workspacePath="~/proj-a"
        onSet={() => {}}
        onClose={() => {}}
        recentWorkspaces={["~/proj-a", "~/proj-b"]}
        onRemoveRecent={() => {}}
      />
    );
    expect(screen.queryByText("~/proj-a")).not.toBeInTheDocument();
    expect(screen.getByText("~/proj-b")).toBeInTheDocument();
  });
});
