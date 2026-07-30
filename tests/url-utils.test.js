import { describe, expect, it } from "vitest";

import {
  collectArticleCandidates,
  fingerprintCandidates,
  normalizeArticleUrl
} from "../extension/lib/url-utils.js";
import { digestLinks } from "./fixtures/digest-links.js";

describe("Medium URL extraction", () => {
  it("extracts the 15 stories and excludes digest chrome/footer links", () => {
    const candidates = collectArticleCandidates(digestLinks);

    expect(candidates).toHaveLength(15);
    expect(candidates.map(({ storyId }) => storyId)).toContain("fc63aa466749");
    expect(candidates.some(({ canonicalUrl }) => canonicalUrl.includes("privacy-policy"))).toBe(false);
    expect(candidates.some(({ canonicalUrl }) => canonicalUrl.includes("jobs-at-medium"))).toBe(false);
  });

  it("removes tracking parameters while preserving a valid friend key", () => {
    const normalized = normalizeArticleUrl(
      "https://medium.com/@vndpal/story-fc63aa466749?source=email&sk=498a9ad32fc0b5b0c5dbffd9121e7548"
    );

    expect(normalized).toEqual({
      canonicalUrl: "https://medium.com/@vndpal/story-fc63aa466749",
      friendKey: "498a9ad32fc0b5b0c5dbffd9121e7548",
      readUrl:
        "https://medium.com/@vndpal/story-fc63aa466749?sk=498a9ad32fc0b5b0c5dbffd9121e7548",
      storyId: "fc63aa466749"
    });
  });

  it("deduplicates the same story and prefers its friend link", () => {
    const candidates = collectArticleCandidates([
      "https://medium.com/@writer/story-aaaaaaaaaaaa?source=email",
      "https://writer.medium.com/story-aaaaaaaaaaaa?sk=bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
    ]);

    expect(candidates).toHaveLength(1);
    expect(candidates[0].friendKey).toBe("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
  });

  it("creates a stable fingerprint independent of link order", () => {
    const candidates = collectArticleCandidates(digestLinks);
    expect(fingerprintCandidates(candidates)).toBe(
      fingerprintCandidates([...candidates].reverse())
    );
  });
});
