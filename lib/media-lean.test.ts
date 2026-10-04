import { describe, expect, it } from "vitest";
import {
  domainOf,
  LEAN_META,
  leanDescription,
  leanForUrl,
  MEDIA_LEAN,
  MEDIA_LEANS,
  outletForUrl,
  withPublisher,
} from "./media-lean";

const GN = "https://news.google.com/rss/articles/CBMiXyz?oc=5";

describe("leanForUrl", () => {
  it("maps article URLs to their outlet's AllSides lean", () => {
    expect(leanForUrl("https://www.theguardian.com/world/2026/oct/04/x")).toBe("left");
    expect(leanForUrl("https://www.npr.org/2026/10/04/x")).toBe("lean-left");
    expect(leanForUrl("https://www.bbc.co.uk/news/articles/x")).toBe("center");
    expect(leanForUrl("https://www.washingtontimes.com/news/2026/oct/4/x/")).toBe("lean-right");
    expect(leanForUrl("https://www.foxnews.com/world/x")).toBe("right");
  });

  it("resolves subdomains to the parent outlet, case-insensitively", () => {
    expect(outletForUrl("https://edition.BBC.com/news")?.outlet).toBe("BBC News");
    expect(outletForUrl("http://feeds.nypost.com/x")?.outlet).toBe("New York Post");
    expect(leanForUrl("https://amp.theguardian.com/x")).toBe("left");
  });

  it("does not match look-alike domains or bare TLDs", () => {
    expect(leanForUrl("https://notnpr.org/x")).toBeNull();
    expect(leanForUrl("https://npr.org.evil.example/x")).toBeNull();
    expect(leanForUrl("https://co.uk/x")).toBeNull();
  });

  it("returns null for unknown, unrated, missing or non-http URLs", () => {
    expect(leanForUrl("https://example.com/x")).toBeNull();
    expect(leanForUrl("https://www.france24.com/en/x")).toBeNull();
    expect(leanForUrl(null)).toBeNull();
    expect(leanForUrl(undefined)).toBeNull();
    expect(leanForUrl("")).toBeNull();
    expect(leanForUrl("not a url")).toBeNull();
    expect(leanForUrl("javascript:alert(1)//npr.org")).toBeNull();
  });

  it("reads the publisher of a Google News redirect from its #publisher tag", () => {
    expect(outletForUrl(`${GN}#publisher=reuters.com`)?.outlet).toBe("Reuters");
    expect(leanForUrl(`${GN}#publisher=apnews.com`)).toBe("lean-left");
    expect(leanForUrl(`${GN}#publisher=washingtonexaminer.com`)).toBe("lean-right");
    // Untagged (older rows) or unknown publisher: no lean, never Google's own.
    expect(leanForUrl(GN)).toBeNull();
    expect(leanForUrl(`${GN}#publisher=example.com`)).toBeNull();
  });
});

describe("withPublisher", () => {
  it("tags Google News links with the publisher's bare domain", () => {
    expect(withPublisher(GN, "https://www.reuters.com")).toBe(`${GN}#publisher=reuters.com`);
    expect(withPublisher(GN, "http://www.washingtonexaminer.com")).toBe(`${GN}#publisher=washingtonexaminer.com`);
    expect(withPublisher(GN, "apnews.com")).toBe(`${GN}#publisher=apnews.com`);
    expect(withPublisher(`${GN}#old`, "reuters.com")).toBe(`${GN}#publisher=reuters.com`);
  });

  it("round-trips through outletForUrl", () => {
    expect(outletForUrl(withPublisher(GN, "https://www.reuters.com"))?.lean).toBe("center");
  });

  it("leaves other links alone and ignores a missing publisher", () => {
    expect(withPublisher("https://www.npr.org/x", "https://www.reuters.com")).toBe("https://www.npr.org/x");
    expect(withPublisher(GN, null)).toBe(GN);
    expect(withPublisher("nope", "reuters.com")).toBe("nope");
  });
});

describe("domainOf", () => {
  it("strips scheme, www. and case", () => {
    expect(domainOf("https://WWW.Reuters.com/world")).toBe("reuters.com");
    expect(domainOf("apnews.com")).toBe("apnews.com");
    expect(domainOf(null)).toBeNull();
  });
});

describe("MEDIA_LEAN table", () => {
  it("uses valid leans and AllSides rating pages", () => {
    for (const [domain, o] of Object.entries(MEDIA_LEAN)) {
      expect(domain).toMatch(/^[a-z0-9.-]+\.[a-z]+$/);
      expect(MEDIA_LEANS).toContain(o.lean);
      expect(o.allsides).toMatch(/^https:\/\/www\.allsides\.com\/news-source\/[a-z0-9-]+$/);
    }
  });

  it("covers every lean bucket", () => {
    const leans = new Set(Object.values(MEDIA_LEAN).map((o) => o.lean));
    expect([...leans].sort()).toEqual([...MEDIA_LEANS].sort());
  });
});

describe("badge text", () => {
  it("has a distinct code and bar position per lean, left to right", () => {
    expect(MEDIA_LEANS.map((l) => LEAN_META[l].code)).toEqual(["L", "LL", "C", "LR", "R"]);
    expect(MEDIA_LEANS.map((l) => LEAN_META[l].position)).toEqual([0, 1, 2, 3, 4]);
  });

  it("describes the outlet for tooltips / aria-labels", () => {
    expect(leanDescription(MEDIA_LEAN["theguardian.com"])).toBe("The Guardian — left (AllSides)");
    expect(leanDescription(MEDIA_LEAN["npr.org"])).toBe("NPR — lean left (AllSides)");
  });
});
