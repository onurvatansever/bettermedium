// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";

import { checkStory } from "../extension/lib/story-checker.js";
import { normalizeArticleUrl } from "../extension/lib/url-utils.js";

const canonicalUrl = "https://medium.com/@writer/example-story-aaaaaaaaaaaa";
const candidate = {
  ...normalizeArticleUrl(canonicalUrl),
  titleHint: "Example story"
};

function response({
  body = "",
  contentType = "text/html; charset=utf-8",
  ok = true,
  status = 200,
  type = "basic",
  url = canonicalUrl
} = {}) {
  return {
    headers: {
      get: (name) => name.toLowerCase() === "content-type" ? contentType : null
    },
    ok,
    status,
    text: async () => body,
    type,
    url
  };
}

function storyHtml(body = "Full public story") {
  return `<!doctype html>
    <html>
      <head>
        <meta property="og:title" content="Example story">
        <link rel="canonical" href="${canonicalUrl}">
      </head>
      <body><article><h1>Example story</h1><p>${body}</p></article></body>
    </html>`;
}

afterEach(() => {
  vi.useRealTimers();
});

describe("Medium network checks", () => {
  it("returns HTTP failures as unknown without losing their reason", async () => {
    const result = await checkStory(candidate, {
      fetchImpl: vi.fn(async () => response({ ok: false, status: 503 }))
    });

    expect(result).toMatchObject({
      status: "unknown",
      reason: "http_503"
    });
  });

  it("aborts a slow request at the configured timeout", async () => {
    vi.useFakeTimers();

    const pending = checkStory(candidate, {
      fetchImpl: vi.fn((_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          reject(new DOMException("Aborted", "AbortError"));
        }, { once: true });
      })),
      timeoutMs: 25
    });

    await vi.advanceTimersByTimeAsync(25);
    await expect(pending).resolves.toMatchObject({
      status: "unknown",
      reason: "timeout"
    });
  });

  it("accepts a same-story redirect inside Medium", async () => {
    const redirectedUrl =
      "https://medium.com/publication/example-story-aaaaaaaaaaaa";
    const fetchImpl = vi.fn(async () =>
      response({
        body: storyHtml(),
        url: redirectedUrl
      })
    );

    const result = await checkStory(candidate, { fetchImpl });

    expect(result).toMatchObject({
      status: "free",
      accessType: "public"
    });
    expect(fetchImpl).toHaveBeenCalledWith(
      canonicalUrl,
      expect.objectContaining({
        credentials: "omit",
        redirect: "follow"
      })
    );
  });

  it("accepts a same-story redirect to a custom publication domain", async () => {
    const customUrl =
      "https://ehandbook.com/example-story-aaaaaaaaaaaa";
    const result = await checkStory(candidate, {
      fetchImpl: vi.fn(async () =>
        response({
          body: storyHtml(),
          url: customUrl
        })
      )
    });

    expect(result).toMatchObject({
      status: "free",
      accessType: "public",
      readUrl: customUrl
    });
  });

  it("finds a same-story Friend Link on a custom publication domain", async () => {
    const customUrl =
      "https://levelup.gitconnected.com/example-story-aaaaaaaaaaaa";
    const friendUrl =
      `${customUrl}?sk=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`;
    const result = await checkStory(candidate, {
      fetchImpl: vi.fn(async () =>
        response({
          body: storyHtml(`<a href="${friendUrl}">Read free</a>`),
          url: customUrl
        })
      )
    });

    expect(result).toMatchObject({
      status: "free",
      accessType: "friend",
      readUrl: friendUrl
    });
  });

  it("rejects a redirect without the same story ID", async () => {
    const externalResult = await checkStory(candidate, {
      fetchImpl: vi.fn(async () =>
        response({ body: storyHtml(), url: "https://example.com/paywall" })
      )
    });
    const otherStoryResult = await checkStory(candidate, {
      fetchImpl: vi.fn(async () =>
        response({
          body: storyHtml(),
          url: "https://medium.com/@writer/other-story-cccccccccccc"
        })
      )
    });

    expect(externalResult).toMatchObject({
      status: "unknown",
      reason: "invalid_redirect_target"
    });
    expect(otherStoryResult).toMatchObject({
      status: "unknown",
      reason: "invalid_redirect_target"
    });
  });

  it("classifies a successful HTML response and rejects non-HTML", async () => {
    const publicResult = await checkStory(candidate, {
      fetchImpl: vi.fn(async () => response({ body: storyHtml() }))
    });
    const nonHtmlResult = await checkStory(candidate, {
      fetchImpl: vi.fn(async () =>
        response({ body: "{}", contentType: "application/json" })
      )
    });

    expect(publicResult).toMatchObject({
      status: "free",
      accessType: "public"
    });
    expect(nonHtmlResult).toMatchObject({
      status: "unknown",
      reason: "not_html"
    });
  });

  it("uses a digest Friend Link without making a network request", async () => {
    const fetchImpl = vi.fn();
    const friendCandidate = {
      ...normalizeArticleUrl(
        `${canonicalUrl}?sk=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`
      ),
      titleHint: "Example story"
    };

    const result = await checkStory(friendCandidate, { fetchImpl });

    expect(result).toMatchObject({
      status: "free",
      accessType: "friend"
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
