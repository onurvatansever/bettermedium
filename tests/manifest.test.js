import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const manifest = JSON.parse(
  readFileSync(new URL("../extension/manifest.json", import.meta.url), "utf8")
);

describe("Extension permissions", () => {
  it("keeps Medium access required and allows exact publication requests", () => {
    expect(manifest.permissions).toContain("webRequest");
    expect(manifest.host_permissions).toEqual([
      "https://medium.com/*",
      "https://*.medium.com/*",
      "https://mail.google.com/*"
    ]);
    expect(manifest.optional_host_permissions).toEqual(["https://*/*"]);
    expect(manifest.content_scripts).toEqual([
      {
        matches: ["https://mail.google.com/*"],
        js: ["content/gmail-observer.js"],
        run_at: "document_idle"
      }
    ]);
  });
});
