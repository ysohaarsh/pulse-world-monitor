import { describe, expect, it } from "vitest";
import type { EventRow } from "@/lib/types";
import { mergeIncoming } from "./merge";

function ev(id: number, occurred_at: string, p: Partial<EventRow> = {}): EventRow {
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
    occurred_at,
    created_at: "2026-10-04T10:00:00Z",
    ...p,
  };
}

const ids = (l: readonly EventRow[]) => l.map((e) => e.id);

describe("mergeIncoming", () => {
  const a = ev(1, "2026-10-04T12:00:00Z");
  const b = ev(2, "2026-10-04T11:00:00Z");
  const c = ev(3, "2026-10-04T10:00:00Z");

  it("puts the newest event first", () => {
    expect(ids(mergeIncoming([b, c], a, 10))).toEqual([1, 2, 3]);
  });

  it("inserts an older event in order and appends the oldest", () => {
    expect(ids(mergeIncoming([a, c], b, 10))).toEqual([1, 2, 3]);
    expect(ids(mergeIncoming([a, b], c, 10))).toEqual([1, 2, 3]);
  });

  it("dedupes by id, with the incoming copy winning", () => {
    const updated = ev(2, "2026-10-04T11:00:00Z", { title: "Updated" });
    const next = mergeIncoming([a, b, c], updated, 10);
    expect(ids(next)).toEqual([1, 2, 3]);
    expect(next[1].title).toBe("Updated");
  });

  it("returns the same array when the duplicate is unchanged", () => {
    const list = [a, b, c];
    expect(mergeIncoming(list, { ...b }, 10)).toBe(list);
  });

  it("repositions an existing event whose occurred_at changed", () => {
    const moved = ev(3, "2026-10-04T13:00:00Z", { title: "Moved" });
    expect(ids(mergeIncoming([a, b, c], moved, 10))).toEqual([3, 1, 2]);
  });

  it("caps the list length, dropping the oldest", () => {
    expect(ids(mergeIncoming([a, b], c, 2))).toEqual([1, 2]);
    expect(ids(mergeIncoming([b, c], a, 2))).toEqual([1, 2]);
  });
});
