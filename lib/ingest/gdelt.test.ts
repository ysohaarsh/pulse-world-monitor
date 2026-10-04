import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gdeltIngester, parseGdeltBody, parseSeenDate, type GdeltRaw } from "./gdelt";

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");
const raw = JSON.parse(fixture("gdelt.json")) as GdeltRaw;

describe("parseSeenDate", () => {
  it("parses GDELT compact timestamps as UTC", () => {
    expect(parseSeenDate("20261004T101500Z")).toBe("2026-10-04T10:15:00.000Z");
  });
  it("rejects malformed or impossible dates", () => {
    expect(parseSeenDate("2026-10-04 09:00")).toBeNull();
    expect(parseSeenDate("20261304T101500Z")).toBeNull();
    expect(parseSeenDate("")).toBeNull();
  });
});

describe("gdeltIngester.normalize", () => {
  const events = gdeltIngester.normalize(raw);

  it("skips invalid items and dedupes by url", () => {
    // 9 articles: 1 duplicate url, 1 bad seendate, 1 invalid url
    expect(events).toHaveLength(6);
    expect(new Set(events.map((e) => e.external_id)).size).toBe(6);
  });

  it("maps fields, geo and classification from the title", () => {
    const e = events[0];
    expect(e).toMatchObject({
      source: "gdelt",
      external_id: "https://www.reuters.com/world/europe/russian-drone-strike-kyiv-bridge-2026-10-04/",
      url: "https://www.reuters.com/world/europe/russian-drone-strike-kyiv-bridge-2026-10-04/",
      title: "Russian drone strike hits Kyiv bridge , dozens dead in overnight attacks",
      summary: "via reuters.com",
      category: "conflict",
      severity: 5,
      occurred_at: "2026-10-04T10:15:00.000Z",
    });
    // Russia and Ukraine both mentioned once → earliest wins
    expect(e.country).toBe("RU");
    expect(e.raw).toEqual(raw.articles[0]);
  });

  it("detects country from title before falling back to sourcecountry", () => {
    const brazil = events.find((e) => e.title.startsWith("Brazil"));
    expect(brazil).toMatchObject({ country: "BR", category: "politics" });

    const cholera = events.find((e) => e.title.startsWith("Cholera"));
    // No country in the title → publisher's country (Australia)
    expect(cholera).toMatchObject({ country: "AU", category: "health", lat: -35.28, lng: 149.13 });

    const markets = events.find((e) => e.title.startsWith("Global markets"));
    expect(markets).toMatchObject({ country: null, lat: null, lng: null, category: "economy" });
  });

  it("tolerates garbage input", () => {
    expect(gdeltIngester.normalize({ articles: [] })).toEqual([]);
    expect(gdeltIngester.normalize(null as unknown as GdeltRaw)).toEqual([]);
    expect(gdeltIngester.normalize({ articles: [42, "x", null] })).toEqual([]);
  });
});

describe("parseGdeltBody", () => {
  it("returns empty articles on the rate-limit text / empty body / {}", () => {
    expect(parseGdeltBody(fixture("gdelt.ratelimit.txt"))).toEqual({ articles: [] });
    expect(parseGdeltBody("")).toEqual({ articles: [] });
    expect(parseGdeltBody("{}")).toEqual({ articles: [] });
  });
  it("passes through article arrays", () => {
    expect(parseGdeltBody(fixture("gdelt.json")).articles).toHaveLength(9);
  });
});

describe("gdeltIngester.fetchRaw", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("soft-fails on a rate-limit text body", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(fixture("gdelt.ratelimit.txt"), { status: 200 })));
    await expect(gdeltIngester.fetchRaw()).resolves.toEqual({ articles: [] });
  });

  it("soft-fails on 429", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("slow down", { status: 429 })));
    await expect(gdeltIngester.fetchRaw()).resolves.toEqual({ articles: [] });
  });

  it("throws on other non-2xx", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("oops", { status: 500 })));
    await expect(gdeltIngester.fetchRaw()).rejects.toThrow("GDELT HTTP 500");
  });

  it("requests the encoded query", async () => {
    const f = vi.fn(async () => new Response(fixture("gdelt.json"), { status: 200 }));
    vi.stubGlobal("fetch", f);
    const res = await gdeltIngester.fetchRaw();
    expect(res.articles).toHaveLength(9);
    const url = new URL(String((f.mock.calls[0] as unknown[])[0]));
    expect(url.searchParams.get("query")).toBe(
      "(conflict OR protest OR disaster OR election OR outbreak) sourcelang:english",
    );
    expect(url.searchParams.get("timespan")).toBe("1h");
  });
});
