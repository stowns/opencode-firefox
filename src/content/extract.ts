interface PageContent {
  title: string;
  url: string;
  text: string;
}

const api = typeof browser !== "undefined" ? browser : chrome;

api.runtime.onMessage.addListener((request: { type: string }, _sender: unknown, sendResponse: (response: PageContent) => void) => {
  if (request.type === "extract-content") {
    const content = extractPageContent();
    sendResponse(content);
  }
  return true;
});

function extractPageContent(): PageContent {
  const title = document.title || "";
  const url = window.location.href;

  let text = "";
  const reader = document.querySelector<HTMLElement>("article, main, [role='main'], .content, #content, .post, .article");
  if (reader) {
    text = reader.innerText || reader.textContent || "";
  } else {
    text = document.body?.innerText || document.body?.textContent || "";
  }

  text = text.replace(/\s+/g, " ").trim();

  const maxLen = 8000;
  if (text.length > maxLen) {
    text = text.substring(0, maxLen) + "...";
  }

  return { title, url, text };
}
