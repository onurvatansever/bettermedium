const STORY_ID_PATTERN = /^[0-9a-f]{12}$/i;
const FRIEND_KEY_PATTERN = /^[0-9a-f]{32}$/i;

const BLOCKED_HOSTS = new Set([
  "help.medium.com",
  "policy.medium.com",
  "status.medium.com"
]);

const BLOCKED_FIRST_SEGMENTS = new Set([
  "about",
  "jobs-at-medium",
  "me",
  "plans",
  "search",
  "tag",
  "topics"
]);

export function isMediumHost(hostname) {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return normalized === "medium.com" || normalized.endsWith(".medium.com");
}

export function extractStoryId(pathname) {
  const finalSegment = pathname
    .split("/")
    .filter(Boolean)
    .at(-1);

  if (!finalSegment) {
    return null;
  }

  if (STORY_ID_PATTERN.test(finalSegment)) {
    return finalSegment.toLowerCase();
  }

  const suffix = finalSegment.match(/-([0-9a-f]{12})$/i);
  return suffix ? suffix[1].toLowerCase() : null;
}

export function readFriendKey(url) {
  try {
    const parsed = url instanceof URL ? url : new URL(url);
    const key = parsed.searchParams.get("sk");
    return key && FRIEND_KEY_PATTERN.test(key) ? key.toLowerCase() : null;
  } catch {
    return null;
  }
}

export function normalizeArticleUrl(rawUrl) {
  try {
    const parsed = new URL(rawUrl);
    const hostname = parsed.hostname.toLowerCase();

    if (parsed.protocol !== "https:" || !isMediumHost(hostname) || BLOCKED_HOSTS.has(hostname)) {
      return null;
    }

    const firstSegment = parsed.pathname.split("/").filter(Boolean)[0]?.toLowerCase();
    if (!firstSegment || BLOCKED_FIRST_SEGMENTS.has(firstSegment)) {
      return null;
    }

    const storyId = extractStoryId(parsed.pathname);
    if (!storyId) {
      return null;
    }

    const canonical = new URL(parsed.origin + parsed.pathname.replace(/\/+$/, ""));
    const friendKey = readFriendKey(parsed);
    const readUrl = friendKey
      ? `${canonical.href}?sk=${friendKey}`
      : canonical.href;

    return {
      canonicalUrl: canonical.href,
      friendKey,
      readUrl,
      storyId
    };
  } catch {
    return null;
  }
}

function normalizeTitle(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function titleFromUrl(url) {
  try {
    const finalSegment = new URL(url).pathname.split("/").filter(Boolean).at(-1) ?? "";
    const withoutId = finalSegment.replace(/-[0-9a-f]{12}$/i, "");
    return withoutId
      .split("-")
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  } catch {
    return "Medium story";
  }
}

export function collectArticleCandidates(links, maximum = 30) {
  const byStoryId = new Map();

  for (const item of links ?? []) {
    const href = typeof item === "string" ? item : item?.href;
    const normalized = normalizeArticleUrl(href);
    if (!normalized) {
      continue;
    }

    const titleHint = normalizeTitle(typeof item === "string" ? "" : item?.text);
    const candidate = {
      ...normalized,
      titleHint: titleHint || titleFromUrl(normalized.canonicalUrl)
    };

    const existing = byStoryId.get(candidate.storyId);
    if (!existing || (!existing.friendKey && candidate.friendKey)) {
      byStoryId.set(candidate.storyId, candidate);
    }

    if (byStoryId.size >= maximum) {
      break;
    }
  }

  return [...byStoryId.values()];
}

export function fingerprintCandidates(candidates) {
  const source = candidates
    .map(({ storyId }) => storyId)
    .sort()
    .join("|");

  let hash = 0x811c9dc5;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(16).padStart(8, "0");
}
