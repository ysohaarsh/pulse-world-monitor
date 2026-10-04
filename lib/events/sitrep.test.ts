import { describe, expect, it } from "vitest";
import type { EventRow } from "@/lib/types";
import { summarizeSitrep, threatLabel } from "./sitrep";

let id = 0;
function ev(p: Partial<EventRow>): EventRow {
  id++;
  return {
    id,
    source: "rss",
    external_id: `x${id}`,
    title: `Event ${id}`,
    summary: null,
    category: "other",
    severity: 1,
    lat: null,
    lng: null,
    country: null,
    url: null,
    occurred_at: "2026-10-04T10:00:00Z",
    created_at: "2026-10-04T10:00:00Z",
    ...p,
  };
}

describe("summarizeSitrep", () => {
  it("handles no events", () => {
    const s = summarizeSitrep([]);
    expect(s.total).toBe(0);
    expect(s.threat).toBe(0);
    expect(s.threatLabel).toBe("LOW");
    expect(s.hotspots).toEqual([]);
    expect(s.priority).toEqual([]);
    expect(s.bySource.map((x) => x.count)).toEqual([0, 0, 0, 0]);
  });

  it("scores threat from the most severe events", () => {
    expect(summarizeSitrep([ev({ severity: 5 }), ev({ severity: 5 })]).threat).toBe(100);
    expect(summarizeSitrep([ev({ severity: 1 })]).threat).toBe(0);
    expect(summarizeSitrep([ev({ severity: 3 })]).threat).toBe(50);
    // Only the top 20 count, so a flood of minor events doesn't dilute a few severe ones.
    const many = [...Array.from({ length: 20 }, () => ev({ severity: 4 })), ...Array.from({ length: 200 }, () => ev({}))];
    expect(summarizeSitrep(many).threat).toBe(75);
  });

  it("labels threat bands", () => {
    expect(threatLabel(0)).toBe("LOW");
    expect(threatLabel(20)).toBe("GUARDED");
    expect(threatLabel(59)).toBe("ELEVATED");
    expect(threatLabel(60)).toBe("HIGH");
    expect(threatLabel(100)).toBe("SEVERE");
  });

  it("counts categories, sources, hotspots and picks priority events", () => {
    const s = summarizeSitrep([
      ev({ category: "conflict", severity: 4, country: "UA", source: "rss", occurred_at: "2026-10-04T09:00:00Z" }),
      ev({ category: "conflict", severity: 3, country: "UA", source: "gdelt", occurred_at: "2026-10-04T11:00:00Z" }),
      ev({ category: "earthquake", severity: 5, country: "TR", source: "usgs" }),
      ev({ category: "politics", severity: 2, country: "BR" }),
    ]);
    expect(s.byCategory[0]).toEqual({ category: "conflict", count: 2 });
    expect(s.highSeverity).toBe(2);
    expect(s.hotspots[0]).toEqual({ country: "UA", count: 2, maxSeverity: 4 });
    expect(s.priority.map((e) => e.severity)).toEqual([5, 4, 3]);
    expect(s.bySource.find((x) => x.source === "gdelt")).toEqual({
      source: "gdelt",
      count: 1,
      latest: "2026-10-04T11:00:00Z",
    });
  });
});
