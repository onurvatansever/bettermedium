import {
  extractStoryId,
  isMediumHost
} from "./url-utils.js";

export function readCustomPublicationRedirect(
  sourceUrl,
  redirectUrl,
  activeStoryIds
) {
  try {
    const source = new URL(sourceUrl);
    const target = new URL(redirectUrl);
    const storyId = extractStoryId(source.pathname);

    if (
      source.protocol !== "https:" ||
      !isMediumHost(source.hostname) ||
      target.protocol !== "https:" ||
      isMediumHost(target.hostname) ||
      !storyId ||
      !activeStoryIds.has(storyId) ||
      extractStoryId(target.pathname) !== storyId
    ) {
      return null;
    }

    return {
      origin: target.origin,
      storyId
    };
  } catch {
    return null;
  }
}
