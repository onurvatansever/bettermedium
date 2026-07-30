import {
  classifyMediumHtml,
  friendResultFromCandidate
} from "./article-classifier.js";
import { normalizeArticleUrl } from "./url-utils.js";

export function unknownResult(candidate, reason) {
  return {
    status: "unknown",
    accessType: null,
    readUrl: null,
    title: candidate?.titleHint ?? "Medium story",
    reason
  };
}

export async function checkStory(
  candidate,
  {
    fetchImpl = globalThis.fetch,
    signal: externalSignal,
    timeoutMs = 10_000
  } = {}
) {
  const normalized = normalizeArticleUrl(candidate?.canonicalUrl);
  if (!normalized) {
    return unknownResult(candidate, "invalid_candidate");
  }

  const directFriend = friendResultFromCandidate(candidate);
  if (directFriend) {
    return directFriend;
  }

  const controller = new AbortController();
  let timedOut = false;
  const abortFromCaller = () => controller.abort();
  externalSignal?.addEventListener("abort", abortFromCaller, { once: true });

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetchImpl(normalized.canonicalUrl, {
      cache: "no-store",
      credentials: "omit",
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      return unknownResult(candidate, `http_${response.status}`);
    }

    const finalUrl = response.url || normalized.canonicalUrl;
    const finalArticle = normalizeArticleUrl(finalUrl);
    if (!finalArticle || finalArticle.storyId !== normalized.storyId) {
      return unknownResult(candidate, "invalid_redirect_target");
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      return unknownResult(candidate, "not_html");
    }

    return classifyMediumHtml({
      candidate,
      finalUrl,
      html: await response.text()
    });
  } catch (error) {
    if (timedOut) {
      return unknownResult(candidate, "timeout");
    }

    return unknownResult(
      candidate,
      error?.name === "AbortError" ? "cancelled" : "network_error"
    );
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener("abort", abortFromCaller);
  }
}
