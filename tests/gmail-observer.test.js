// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const observerSource = readFileSync(
  resolve("extension/content/gmail-observer.js"),
  "utf8"
);

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe("Gmail digest observer", () => {
  it("sends only visible Medium story links and deduplicates DOM changes", async () => {
    vi.useFakeTimers();
    const sendMessage = vi.fn(async () => null);
    vi.stubGlobal("browser", {
      runtime: {
        sendMessage
      }
    });
    vi.spyOn(Element.prototype, "getClientRects").mockReturnValue([{}]);

    document.body.innerHTML = `
      <a href="https://medium.com/@writer/story-aaaaaaaaaaaa">Story one</a>
      <a href="https://medium.com/me/settings">Settings</a>
      <a href="https://example.com/story-bbbbbbbbbbbb">Other site</a>
      <a href="https://medium.com/@writer/hidden-cccccccccccc" style="display:none">
        Hidden story
      </a>
    `;

    window.eval(observerSource);
    await vi.advanceTimersByTimeAsync(700);

    expect(sendMessage).toHaveBeenCalledOnce();
    expect(sendMessage).toHaveBeenCalledWith({
      type: "ANALYZE_GMAIL_DIGEST",
      links: [{
        href: "https://medium.com/@writer/story-aaaaaaaaaaaa",
        text: "Story one"
      }]
    });

    document.body.append(document.createElement("div"));
    await vi.advanceTimersByTimeAsync(700);
    expect(sendMessage).toHaveBeenCalledOnce();
  });
});
