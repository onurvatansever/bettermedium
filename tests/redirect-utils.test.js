import { describe, expect, it } from "vitest";

import { readCustomPublicationRedirect } from "../extension/lib/redirect-utils.js";

const STORY_ID = "16e0126288f7";
const activeStoryIds = new Set([STORY_ID]);

describe("Custom publication redirects", () => {
  it("returns the exact HTTPS origin for an active Medium story", () => {
    expect(
      readCustomPublicationRedirect(
        `https://medium.com/@writer/story-${STORY_ID}`,
        `https://ehandbook.com/story-${STORY_ID}`,
        activeStoryIds
      )
    ).toEqual({
      origin: "https://ehandbook.com",
      storyId: STORY_ID
    });
  });

  it.each([
    [
      "non-Medium source",
      `https://example.com/story-${STORY_ID}`,
      `https://ehandbook.com/story-${STORY_ID}`,
      activeStoryIds
    ],
    [
      "inactive story",
      `https://medium.com/@writer/story-${STORY_ID}`,
      `https://ehandbook.com/story-${STORY_ID}`,
      new Set()
    ],
    [
      "different target story",
      `https://medium.com/@writer/story-${STORY_ID}`,
      "https://ehandbook.com/story-aaaaaaaaaaaa",
      activeStoryIds
    ],
    [
      "insecure target",
      `https://medium.com/@writer/story-${STORY_ID}`,
      `http://ehandbook.com/story-${STORY_ID}`,
      activeStoryIds
    ],
    [
      "Medium target",
      `https://medium.com/@writer/story-${STORY_ID}`,
      `https://towardsdatascience.medium.com/story-${STORY_ID}`,
      activeStoryIds
    ]
  ])("rejects a %s", (_label, source, target, storyIds) => {
    expect(
      readCustomPublicationRedirect(source, target, storyIds)
    ).toBeNull();
  });
});
