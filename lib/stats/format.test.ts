import { describe, expect, it } from "vitest";
import { countryName, formatUtc, formatUtcDate } from "./format";

describe("countryName", () => {
  it("resolves known codes case-insensitively", () => {
    expect(countryName("fr")).toBe(countryName("FR"));
    expect(countryName("FR")).not.toBe("FR");
  });

  it("falls back to the raw code when nothing resolves it", () => {
    expect(countryName("not-a-code")).toBe("not-a-code");
  });
});

describe("formatUtc", () => {
  it("formats in UTC regardless of the host timezone", () => {
    expect(formatUtc("2026-10-04T12:34:00Z")).toBe("4 Oct 2026, 12:34 UTC");
    expect(formatUtcDate("2026-10-04T23:59:00Z")).toBe("4 Oct 2026");
  });

  it("returns the input unchanged when it is not a date", () => {
    expect(formatUtc("garbage")).toBe("garbage");
    expect(formatUtcDate("garbage")).toBe("garbage");
  });
});
