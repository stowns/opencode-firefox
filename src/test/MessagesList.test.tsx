import { render, screen } from "@testing-library/react";
import MessagesList from "../sidebar/components/MessagesList";
import type { Marked } from "marked";

const mockMarked = {
  parse: (text: string) => `<p>${text}</p>`,
} as unknown as Marked;

describe("MessagesList SSE response rendering", () => {
  it("renders assistant text message from SSE event", () => {
    render(
      <MessagesList
        messages={[
          { role: "user", parts: [{ type: "text", text: "what's in the active tab" }] },
          {
            role: "assistant",
            parts: [{ type: "text", text: 'The active tab is **"hello network"** at `https://hello.com/`.' }],
          },
        ]}
        marked={mockMarked}
        workingStatus={null}
        pendingPermission={null}
        respondToPermission={() => {}}
        pendingQuestion={null}
        answerQuestion={() => {}}
        abortSession={() => {}}
      />
    );

    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("what's in the active tab")).toBeInTheDocument();
    expect(screen.getByText("OpenCode")).toBeInTheDocument();
    expect(screen.getByText(/hello network/)).toBeInTheDocument();
  });

  it("renders assistant message with modelID from message.updated event", () => {
    render(
      <MessagesList
        messages={[
          { role: "user", parts: [{ type: "text", text: "test" }] },
          {
            role: "assistant",
            parts: [{ type: "text", text: "Yes, I'm working. How can I help you?" }],
            info: { role: "assistant", modelID: "qwen3.6-plus" },
          },
        ]}
        marked={mockMarked}
        workingStatus={null}
        pendingPermission={null}
        respondToPermission={() => {}}
        pendingQuestion={null}
        answerQuestion={() => {}}
        abortSession={() => {}}
      />
    );

    expect(screen.getByText("Yes, I'm working. How can I help you?")).toBeInTheDocument();
    expect(screen.getByText("qwen3.6-plus")).toBeInTheDocument();
  });

  it("does not show working indicator when session is idle", () => {
    render(
      <MessagesList
        messages={[
          { role: "user", parts: [{ type: "text", text: "test" }] },
          {
            role: "assistant",
            parts: [{ type: "text", text: "Response" }],
          },
        ]}
        marked={mockMarked}
        workingStatus={null}
        pendingPermission={null}
        respondToPermission={() => {}}
        pendingQuestion={null}
        answerQuestion={() => {}}
        abortSession={() => {}}
      />
    );

    expect(document.querySelector(".working-dots")).not.toBeInTheDocument();
    expect(screen.queryByText("Thinking...")).not.toBeInTheDocument();
  });

  it("shows working indicator when session is busy", () => {
    const abortSession = vi.fn();
    render(
      <MessagesList
        messages={[
          { role: "user", parts: [{ type: "text", text: "test" }] },
        ]}
        marked={mockMarked}
        workingStatus={{ type: "thinking", text: "Thinking..." }}
        pendingPermission={null}
        respondToPermission={() => {}}
        pendingQuestion={null}
        answerQuestion={() => {}}
        abortSession={abortSession}
      />
    );

    expect(screen.getByText("Thinking...")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
  });

  it("renders assistant message even without info field", () => {
    render(
      <MessagesList
        messages={[
          { role: "user", parts: [{ type: "text", text: "hello" }] },
          {
            role: "assistant",
            parts: [{ type: "text", text: "Hi there!" }],
          },
        ]}
        marked={mockMarked}
        workingStatus={null}
        pendingPermission={null}
        respondToPermission={() => {}}
        pendingQuestion={null}
        answerQuestion={() => {}}
        abortSession={() => {}}
      />
    );

    expect(screen.getByText("Hi there!")).toBeInTheDocument();
  });

  it("filters out assistant messages with empty text", () => {
    render(
      <MessagesList
        messages={[
          { role: "user", parts: [{ type: "text", text: "hello" }] },
          {
            role: "assistant",
            parts: [{ type: "text", text: "" }],
          },
        ]}
        marked={mockMarked}
        workingStatus={null}
        pendingPermission={null}
        respondToPermission={() => {}}
        pendingQuestion={null}
        answerQuestion={() => {}}
        abortSession={() => {}}
      />
    );

    expect(screen.queryByText("OpenCode")).not.toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
  });
});
