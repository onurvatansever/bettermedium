import { afterEach, describe, expect, it, vi } from "vitest";

const checkStory = vi.fn(async (candidate) => ({
  accessType: "public",
  readUrl: candidate.canonicalUrl,
  reason: "public_story",
  status: "free",
  title: candidate.titleHint
}));

vi.mock("../extension/lib/story-checker.js", () => ({
  checkStory,
  unknownResult: vi.fn()
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
  checkStory.mockClear();
});

describe("Background automation", () => {
  it("automatically reruns the stored analysis when publication access is added", async () => {
    const candidate = {
      canonicalUrl: "https://medium.com/@writer/story-aaaaaaaaaaaa",
      storyId: "aaaaaaaaaaaa",
      titleHint: "Example story"
    };
    const stored = {
      analysisJob: {
        candidates: [candidate],
        completed: 1,
        error: null,
        fingerprint: "digest",
        finishedAt: "2026-07-30T00:00:00.000Z",
        free: [],
        id: "old-job",
        lockedCount: 0,
        requiredOrigins: ["https://ehandbook.com"],
        results: [{
          index: 0,
          result: {
            reason: "permission_required",
            requiredOrigin: "https://ehandbook.com",
            status: "unknown"
          }
        }],
        schemaVersion: 2,
        startedAt: "2026-07-30T00:00:00.000Z",
        status: "completed",
        total: 1,
        unknownCount: 1
      }
    };
    let permissionAdded;
    const contains = vi.fn(async () => true);

    vi.stubGlobal("browser", {
      permissions: {
        contains,
        onAdded: {
          addListener: vi.fn((listener) => {
            permissionAdded = listener;
          })
        }
      },
      runtime: {
        onMessage: {
          addListener: vi.fn()
        }
      },
      storage: {
        session: {
          get: vi.fn(async () => ({ analysisJob: stored.analysisJob })),
          set: vi.fn(async ({ analysisJob }) => {
            stored.analysisJob = analysisJob;
          })
        }
      },
      webRequest: {
        onBeforeRedirect: {
          addListener: vi.fn()
        }
      }
    });

    await import("../extension/background.js");
    permissionAdded({
      origins: ["https://ehandbook.com/*"]
    });

    await vi.waitFor(() => {
      expect(stored.analysisJob.id).not.toBe("old-job");
      expect(stored.analysisJob.status).toBe("completed");
      expect(stored.analysisJob.free).toHaveLength(1);
    });
    expect(contains).toHaveBeenCalledWith({
      origins: ["https://ehandbook.com/*"]
    });
    expect(checkStory).toHaveBeenCalledOnce();
  });

  it("starts a new analysis only for digest links sent by Gmail", async () => {
    const stored = {};
    let messageListener;

    vi.stubGlobal("browser", {
      permissions: {
        contains: vi.fn(async () => false),
        onAdded: {
          addListener: vi.fn()
        }
      },
      runtime: {
        onMessage: {
          addListener: vi.fn((listener) => {
            messageListener = listener;
          })
        }
      },
      storage: {
        session: {
          get: vi.fn(async () => ({ analysisJob: stored.analysisJob })),
          set: vi.fn(async ({ analysisJob }) => {
            stored.analysisJob = analysisJob;
          })
        }
      },
      webRequest: {
        onBeforeRedirect: {
          addListener: vi.fn()
        }
      }
    });

    await import("../extension/background.js");

    const message = {
      type: "ANALYZE_GMAIL_DIGEST",
      links: [{
        href: "https://medium.com/@writer/story-aaaaaaaaaaaa",
        text: "Example story"
      }]
    };
    expect(
      messageListener(message, {
        tab: { url: "https://example.com/not-gmail" }
      })
    ).toBeUndefined();

    const result = await messageListener(message, {
      tab: { url: "https://mail.google.com/mail/u/0/#inbox/example" }
    });

    expect(result.status).toBe("completed");
    expect(result.total).toBe(1);
    expect(stored.analysisJob.free).toHaveLength(1);
    expect(checkStory).toHaveBeenCalledOnce();
  });
});
