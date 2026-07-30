import {
  extractStoryId,
  isMediumHost,
  normalizeArticleUrl,
  readFriendKey
} from "./url-utils.js";

function cleanTitle(value, fallback) {
  const cleaned = String(value ?? "")
    .replace(/\s*[|–—-]\s*Medium\s*$/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return (cleaned || fallback || "Medium story").slice(0, 240);
}

function parseDocument(html) {
  if (typeof DOMParser === "undefined") {
    throw new Error("DOMParser is unavailable");
  }
  return new DOMParser().parseFromString(html, "text/html");
}

function findFriendLink(document, storyId, baseUrl) {
  let baseOrigin;
  try {
    baseOrigin = new URL(baseUrl).origin;
  } catch {
    return null;
  }

  for (const anchor of document.querySelectorAll("a[href]")) {
    try {
      const candidate = new URL(anchor.getAttribute("href"), baseUrl);
      if (
        candidate.protocol !== "https:" ||
        (!isMediumHost(candidate.hostname) && candidate.origin !== baseOrigin)
      ) {
        continue;
      }

      const friendKey = readFriendKey(candidate);
      if (!friendKey || extractStoryId(candidate.pathname) !== storyId) {
        continue;
      }

      return `${candidate.origin}${candidate.pathname.replace(/\/+$/, "")}?sk=${friendKey}`;
    } catch {
      // Ignore malformed links embedded in the document.
    }
  }

  return null;
}

function readUrlFromFinalUrl(finalUrl, fallback) {
  try {
    const parsed = new URL(finalUrl);
    if (parsed.protocol !== "https:") {
      return fallback;
    }
    return `${parsed.origin}${parsed.pathname.replace(/\/+$/, "")}`;
  } catch {
    return fallback;
  }
}

function hasLockedSignal(document, html) {
  const bodyText = document.body?.textContent ?? "";
  return (
    /member-only story/i.test(bodyText) ||
    /"isLocked"\s*:\s*true/i.test(html) ||
    /\\"isLocked\\"\s*:\s*true/i.test(html)
  );
}

function readDocumentTitle(document) {
  return (
    document.querySelector('meta[property="og:title"]')?.getAttribute("content") ||
    document.querySelector("article h1, main h1, h1")?.textContent ||
    document.title
  );
}

function isValidStoryDocument(document, expectedStoryId, finalUrl) {
  const title = readDocumentTitle(document);
  if (!title || !String(title).trim()) {
    return false;
  }

  const finalStoryId = extractStoryId(new URL(finalUrl).pathname);
  if (finalStoryId === expectedStoryId) {
    return true;
  }

  const canonicalHref = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
  if (!canonicalHref) {
    return false;
  }

  try {
    return extractStoryId(new URL(canonicalHref, finalUrl).pathname) === expectedStoryId;
  } catch {
    return false;
  }
}

export function classifyMediumHtml({
  candidate,
  finalUrl = candidate?.canonicalUrl,
  html
}) {
  const normalized = normalizeArticleUrl(candidate?.readUrl ?? candidate?.canonicalUrl);
  if (!normalized || typeof html !== "string" || !html.trim()) {
    return {
      status: "unknown",
      accessType: null,
      readUrl: null,
      title: candidate?.titleHint ?? "Medium story",
      reason: "invalid_response"
    };
  }

  let document;
  try {
    document = parseDocument(html);
  } catch {
    return {
      status: "unknown",
      accessType: null,
      readUrl: null,
      title: candidate?.titleHint ?? "Medium story",
      reason: "parse_failed"
    };
  }

  const title = cleanTitle(readDocumentTitle(document), candidate?.titleHint);
  const friendUrl = findFriendLink(document, normalized.storyId, finalUrl);

  if (friendUrl) {
    return {
      status: "free",
      accessType: "friend",
      readUrl: friendUrl,
      title,
      reason: "friend_link_found"
    };
  }

  if (!isValidStoryDocument(document, normalized.storyId, finalUrl)) {
    return {
      status: "unknown",
      accessType: null,
      readUrl: null,
      title,
      reason: "not_a_story_document"
    };
  }

  if (hasLockedSignal(document, html)) {
    return {
      status: "locked",
      accessType: null,
      readUrl: null,
      title,
      reason: "member_only"
    };
  }

  return {
    status: "free",
    accessType: "public",
    readUrl: readUrlFromFinalUrl(finalUrl, normalized.canonicalUrl),
    title,
    reason: "public_story"
  };
}

export function friendResultFromCandidate(candidate) {
  if (!candidate?.friendKey) {
    return null;
  }

  return {
    status: "free",
    accessType: "friend",
    readUrl: candidate.readUrl,
    title: candidate.titleHint,
    reason: "friend_link_in_digest"
  };
}
