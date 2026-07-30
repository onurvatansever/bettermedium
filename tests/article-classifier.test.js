// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  classifyMediumHtml,
  friendResultFromCandidate
} from "../extension/lib/article-classifier.js";
import { normalizeArticleUrl } from "../extension/lib/url-utils.js";

const canonicalUrl = "https://medium.com/@writer/example-story-aaaaaaaaaaaa";
const candidate = {
  ...normalizeArticleUrl(canonicalUrl),
  titleHint: "Example story"
};

function storyHtml(body, title = "Example story") {
  return `<!doctype html>
    <html>
      <head>
        <title>${title} | Medium</title>
        <meta property="og:title" content="${title}">
        <link rel="canonical" href="${canonicalUrl}">
      </head>
      <body><article><h1>${title}</h1>${body}</article></body>
    </html>`;
}

describe("Medium story classification", () => {
  it("returns an author-shared friend link for the same story", () => {
    const result = classifyMediumHtml({
      candidate,
      html: storyHtml(
        '<p>Member-only story</p><a href="/@writer/example-story-aaaaaaaaaaaa?sk=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb">Read free</a>'
      )
    });

    expect(result.status).toBe("free");
    expect(result.accessType).toBe("friend");
    expect(result.readUrl).toBe(
      "https://medium.com/@writer/example-story-aaaaaaaaaaaa?sk=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    );
  });

  it("does not accept a friend link belonging to another story", () => {
    const result = classifyMediumHtml({
      candidate,
      html: storyHtml(
        '<p>Member-only story</p><a href="/@writer/other-story-cccccccccccc?sk=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb">Other</a>'
      )
    });

    expect(result.status).toBe("locked");
  });

  it("classifies a valid story without a locked signal as public", () => {
    const result = classifyMediumHtml({
      candidate,
      html: storyHtml("<p>The complete public story.</p>")
    });

    expect(result).toMatchObject({
      status: "free",
      accessType: "public",
      readUrl: canonicalUrl
    });
  });

  it("keeps member-only stories without friend links locked", () => {
    const result = classifyMediumHtml({
      candidate,
      html: storyHtml("<p>Member-only story</p><p>Preview only.</p>")
    });

    expect(result.status).toBe("locked");
    expect(result.readUrl).toBeNull();
  });

  it("treats malformed or challenge HTML conservatively", () => {
    const result = classifyMediumHtml({
      candidate,
      html: "<html><body>Checking your browser…</body></html>"
    });

    expect(result.status).toBe("unknown");
    expect(result.reason).toBe("not_a_story_document");
  });

  it("uses a friend key already present in the digest without fetching", () => {
    const friendCandidate = {
      ...normalizeArticleUrl(
        `${canonicalUrl}?sk=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`
      ),
      titleHint: "Example story"
    };

    expect(friendResultFromCandidate(friendCandidate)).toMatchObject({
      status: "free",
      accessType: "friend",
      readUrl: `${canonicalUrl}?sk=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb`
    });
  });
});
