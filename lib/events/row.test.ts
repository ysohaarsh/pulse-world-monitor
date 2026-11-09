import { describe, expect, it } from "vitest";
import { hasCoords, toEventRow } from "./row";

const valid = {
  id: 1,
  source: "usgs",
  external_id: "us123",
  title: "M 5.1 - Somewhere",
  summary: null,
  category: "earthquake",
  severity: 3,
  lat: 10.5,
  lng: -20.25,
  country: "CL",
  url: "https://example.com/e",
  occurred_at: "2026-10-01T00:00:00Z",
  created_at: "2026-10-01T00:01:00Z",
};

describe("toEventRow", () => {
  it("accepts a valid row and strips extra fields such as raw", () => {
    const row = toEventRow({ ...valid, raw: { big: "payload" } });
    expect(row).toEqual(valid);
    expect(row).not.toHaveProperty("raw");
  });

  it("coerces numeric strings for id and severity (realtime/bigint payloads)", () => {
    const row = toEventRow({ ...valid, id: "42", severity: "4" });
    expect(row?.id).toBe(42);
    expect(row?.severity).toBe(4);
  });

  it("defaults omitted nullable fields to null", () => {
    const rest: Record<string, unknown> = { ...valid };
    for (const k of ["summary", "lat", "lng", "country", "url"]) delete rest[k];
    const row = toEventRow(rest);
    expect(row).toMatchObject({ summary: null, lat: null, lng: null, country: null, url: null });
  });

  it.each([
    ["unknown source", { source: "twitter" }],
    ["unknown category", { category: "memes" }],
    ["severity out of range", { severity: 6 }],
    ["non-integer severity", { severity: 2.5 }],
    ["missing title", { title: undefined }],
  ])("returns null for %s", (_name, patch) => {
    expect(toEventRow({ ...valid, ...patch })).toBeNull();
  });

  it("returns null for non-objects", () => {
    expect(toEventRow(null)).toBeNull();
    expect(toEventRow("nope")).toBeNull();
  });
});

describe("hasCoords", () => {
  it("is true only when both lat and lng are numbers (including 0)", () => {
    const row = toEventRow(valid)!;
    expect(hasCoords(row)).toBe(true);
    expect(hasCoords({ ...row, lat: 0, lng: 0 })).toBe(true);
    expect(hasCoords({ ...row, lat: null })).toBe(false);
    expect(hasCoords({ ...row, lng: null })).toBe(false);
  });
});
