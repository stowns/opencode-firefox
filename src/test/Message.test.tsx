import { render, screen } from "@testing-library/react";
import Message from "../sidebar/components/Message";
import type { Marked } from "marked";

const mockMarked = {
  parse: (text: string) => `<p>${text}</p>`,
} as unknown as Marked;

describe("Message", () => {
  it("renders user message", () => {
    render(
      <Message
        msg={{
          role: "user",
          parts: [{ type: "text", text: "Hello" }],
        }}
        marked={mockMarked}
      />
    );
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("renders assistant message", () => {
    render(
      <Message
        msg={{
          role: "assistant",
          parts: [{ type: "text", text: "Hi there" }],
        }}
        marked={mockMarked}
      />
    );
    expect(screen.getByText("OpenCode")).toBeInTheDocument();
    expect(screen.getByText("Hi there")).toBeInTheDocument();
  });

  it("shows model name for assistant messages", () => {
    render(
      <Message
        msg={{
          role: "assistant",
          parts: [{ type: "text", text: "Response" }],
          info: { modelID: "qwen3.6-plus", role: "assistant" },
        }}
        marked={mockMarked}
      />
    );
    expect(screen.getByText("qwen3.6-plus")).toBeInTheDocument();
  });

  it("does not show model name for user messages", () => {
    render(
      <Message
        msg={{
          role: "user",
          parts: [{ type: "text", text: "Hello" }],
          info: { modelID: "qwen3.6-plus", role: "user" },
        }}
        marked={mockMarked}
      />
    );
    expect(screen.queryByText("qwen3.6-plus")).not.toBeInTheDocument();
  });

  it("renders error message", () => {
    render(
      <Message
        msg={{
          role: "assistant",
          parts: [{ type: "text", text: "Error occurred" }],
          error: true,
        }}
        marked={mockMarked}
      />
    );
    expect(screen.getByText("!")).toBeInTheDocument();
    expect(screen.getByText("Error occurred")).toBeInTheDocument();
  });

  it("shows context button for user messages with context when developer mode is enabled", () => {
    render(
      <Message
        msg={{
          role: "user",
          parts: [{ type: "text", text: "Hello" }],
          context: "Some context",
        }}
        marked={mockMarked}
        developerMode={true}
      />
    );
    expect(screen.getByText("View Context")).toBeInTheDocument();
  });

  it("hides context button when developer mode is disabled", () => {
    render(
      <Message
        msg={{
          role: "user",
          parts: [{ type: "text", text: "Hello" }],
          context: "Some context",
        }}
        marked={mockMarked}
        developerMode={false}
      />
    );
    const wrapper = document.querySelector(".message-context-wrapper");
    expect(wrapper).toHaveClass("hidden");
  });

  it("shows context button when developer mode is enabled", () => {
    render(
      <Message
        msg={{
          role: "user",
          parts: [{ type: "text", text: "Hello" }],
          context: "Some context",
        }}
        marked={mockMarked}
        developerMode={true}
      />
    );
    const wrapper = document.querySelector(".message-context-wrapper");
    expect(wrapper).not.toHaveClass("hidden");
  });

  it("shows copy button for assistant messages", () => {
    render(
      <Message
        msg={{
          role: "assistant",
          parts: [{ type: "text", text: "Response text" }],
        }}
        marked={mockMarked}
      />
    );
    expect(screen.getByText("Copy")).toBeInTheDocument();
  });
});
