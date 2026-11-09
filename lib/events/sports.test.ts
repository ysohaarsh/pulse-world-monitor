import { describe, expect, it } from "vitest";
import { CORE_CATEGORIES, CORE_SOURCES, isSportsEvent, withoutSports } from "./sports";

describe("sports helpers", () => {
  it("excludes sports from the core category and source lists", () => {
    expect(CORE_CATEGORIES).not.toContain("sports");
    expect(CORE_SOURCES).not.toContain("sports");
    expect(CORE_CATEGORIES).toContain("earthquake");
    expect(CORE_SOURCES).toContain("usgs");
  });

  it("treats either the sports category or the sports source as sports", () => {
    expect(isSportsEvent({ category: "sports", source: "rss" })).toBe(true);
    expect(isSportsEvent({ category: "other", source: "sports" })).toBe(true);
    expect(isSportsEvent({ category: "conflict", source: "gdelt" })).toBe(false);
  });

  it("withoutSports drops sports events and keeps order of the rest", () => {
    const events = [
      { id: 1, category: "conflict", source: "gdelt" },
      { id: 2, category: "sports", source: "rss" },
      { id: 3, category: "other", source: "sports" },
      { id: 4, category: "storm", source: "gdacs" },
    ] as const;
    expect(withoutSports(events).map((e) => e.id)).toEqual([1, 4]);
  });
});
