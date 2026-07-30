// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

const popupHtml = readFileSync(
  resolve("extension/popup/popup.html"),
  "utf8"
);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("Popup publication permission flow", () => {
  it("removes legacy broad access and requests only detected domains", async () => {
    document.open();
    document.write(popupHtml);
    document.close();

    const permissionJob = {
      completed: 2,
      fingerprint: "new",
      free: [],
      lockedCount: 0,
      requiredOrigins: [
        "https://levelup.gitconnected.com",
        "https://ehandbook.com"
      ],
      schemaVersion: 2,
      status: "completed",
      total: 2,
      unknownCount: 2
    };
    const completedJob = {
      ...permissionJob,
      lockedCount: 2,
      requiredOrigins: [],
      unknownCount: 0
    };
    let scanCount = 0;
    const sendMessage = vi.fn(async ({ type }) => {
      if (type === "GET_ANALYSIS_STATE") {
        return null;
      }

      scanCount += 1;
      return type === "START_ANALYSIS" ? permissionJob : completedJob;
    });
    const request = vi.fn(async () => true);
    const remove = vi.fn(async () => true);

    vi.stubGlobal("browser", {
      permissions: {
        contains: vi.fn(async () => true),
        remove,
        request
      },
      runtime: {
        sendMessage
      },
      scripting: {
        executeScript: vi.fn(async () => [{
          result: {
            code: "ok",
            links: [
              {
                href: "https://medium.com/@writer/example-story-aaaaaaaaaaaa",
                text: "Example story"
              },
              {
                href: "https://medium.com/@writer/another-story-bbbbbbbbbbbb",
                text: "Another story"
              }
            ],
            ok: true
          }
        }])
      },
      storage: {
        onChanged: {
          addListener: vi.fn()
        }
      },
      tabs: {
        query: vi.fn(async () => [{ id: 42 }])
      }
    });

    await import("../extension/popup/popup.js");

    const panel = document.querySelector("#permission-panel");
    const message = document.querySelector("#permission-message");
    const button = document.querySelector("#permission-button");

    await vi.waitFor(() => expect(panel.hidden).toBe(false));
    expect(message.textContent).toContain("ehandbook.com");
    expect(message.textContent).toContain("levelup.gitconnected.com");
    expect(remove).toHaveBeenCalledWith({
      origins: ["https://*/*"]
    });

    button.click();

    await vi.waitFor(() => {
      expect(request).toHaveBeenCalledWith({
        origins: [
          "https://ehandbook.com/*",
          "https://levelup.gitconnected.com/*"
        ]
      });
      expect(sendMessage).toHaveBeenCalledWith({
        type: "RETRY_AFTER_PERMISSION"
      });
      expect(scanCount).toBe(2);
      expect(panel.hidden).toBe(true);
    });
    expect(request).not.toHaveBeenCalledWith({
      origins: ["https://*/*"]
    });
  });
});
