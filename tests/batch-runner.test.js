import { describe, expect, it } from "vitest";

import { runConcurrent } from "../extension/lib/batch-runner.js";

describe("Concurrent article checks", () => {
  it("keeps successful results when one article check throws", async () => {
    const settled = [];
    let active = 0;
    let maximumActive = 0;

    const results = await runConcurrent(
      ["public", "broken", "friend", "locked"],
      async (value) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        await Promise.resolve();
        active -= 1;

        if (value === "broken") {
          throw new Error("network parser failed");
        }

        return { status: value === "locked" ? "locked" : "free", value };
      },
      {
        concurrency: 2,
        onError: (_error, value) => ({ status: "unknown", value }),
        onSettled: (result) => {
          settled.push(result);
        }
      }
    );

    expect(results).toHaveLength(4);
    expect(results.filter(({ status }) => status === "free")).toHaveLength(2);
    expect(results).toContainEqual({ status: "unknown", value: "broken" });
    expect(settled).toHaveLength(4);
    expect(maximumActive).toBeLessThanOrEqual(2);
  });
});
