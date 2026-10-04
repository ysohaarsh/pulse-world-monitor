import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanTitle,
  decodeEntities,
  feedCaps,
  MAX_ITEMS_PER_FEED,
  MAX_ITEMS_PER_LEAN,
  parseFeedDate,
  parseRss,
  RSS_FEEDS,
  rssIngester,
  toSummary,
  type RssFeedRaw,
} from "./rss";
import { leanForUrl, MEDIA_LEAN, MEDIA_LEANS } from "@/lib/media-lean";

const fixture = (name: string) => readFileSync(join(__dirname, "__fixtures__", name), "utf8");

const FEEDS: RssFeedRaw[] = [
  { feed: "bbc", xml: fixture("rss.bbc.xml") },
  { feed: "aljazeera", xml: fixture("rss.aljazeera.xml") },
  { feed: "npr", xml: fixture("rss.npr.xml") },
  { feed: "guardian", xml: fixture("rss.guardian.xml") },
];

const EDGE_XML = `<?xml version="1.0"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/"><channel>
  <title>Edge cases</title>
  <atom:link href="https://example.com/feed" rel="self"/>
  <item>
    <title><![CDATA[Floods & landslides kill 12 in Nepal <live>]]></title>
    <media:title>ignore me</media:title>
    <link>https://example.com/a?x=1&amp;y=2</link>
    <description>&lt;p&gt;Rescuers search for &lt;b&gt;missing&lt;/b&gt; villagers &amp;amp; livestock.&lt;/p&gt;</description>
    <pubDate>Sun, 04 Oct 2026 08:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Tom &amp; Jerry&#8217;s &#x201C;art&#x201D; show opens</title>
    <link>https://example.com/b</link>
    <guid isPermaLink="false">b-guid</guid>
    <pubDate>not a date</pubDate>
  </item>
  <item>
    <link>https://example.com/no-title</link>
    <pubDate>Sun, 04 Oct 2026 08:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Duplicate of first</title>
    <link>https://example.com/a?x=1&amp;y=2</link>
    <pubDate>Sun, 04 Oct 2026 09:00:00 GMT</pubDate>
  </item>
  <item>
    <title>Scientists unveil a faster battery</title>
    <guid>c-guid</guid>
    <pubDate>Sun, 04 Oct 2026 07:00:00 +0200</pubDate>
  </item>
</channel></rss>`;

describe("decodeEntities", () => {
  it("decodes named and numeric entities", () => {
    expect(decodeEntities("a &amp; b &lt;c&gt; &quot;d&quot; &#39;e&#39; &#8211; &#x2019; &nbsp;")).toBe(
      "a & b <c> \"d\" 'e' – ’  ",
    );
    expect(decodeEntities("&unknown; stays")).toBe("&unknown; stays");
  });
});

describe("parseRss", () => {
  const items = parseRss(EDGE_XML);

  it("finds every <item>", () => {
    expect(items).toHaveLength(5);
  });

  it("keeps CDATA verbatim and decodes entities outside CDATA", () => {
    expect(items[0].title).toBe("Floods & landslides kill 12 in Nepal <live>");
    expect(items[0].link).toBe("https://example.com/a?x=1&y=2");
    expect(items[1].title).toBe("Tom & Jerry’s “art” show opens");
  });

  it("does not confuse namespaced tags", () => {
    expect(items[0].title).not.toBe("ignore me");
    expect(parseRss(EDGE_XML).some((i) => i.link === "https://example.com/feed")).toBe(false);
  });

  it("returns null for missing fields", () => {
    expect(items[0].guid).toBeNull();
    expect(items[2].title).toBeNull();
    expect(items[4].link).toBeNull();
  });

  it("parses real feeds", () => {
    const bbc = parseRss(fixture("rss.bbc.xml"));
    expect(bbc).toHaveLength(3);
    expect(bbc[0]).toMatchObject({
      title: "Kyiv bridge hit in further Russian drone attack as German chancellor makes surprise visit",
      link: "https://www.bbc.co.uk/news/articles/ckreyjzzzywqo?at_medium=RSS&at_campaign=rss",
      guid: "https://www.bbc.co.uk/news/articles/ckreyjzzzywqo#0",
      pubDate: "Sun, 04 Oct 2026 11:25:35 GMT",
    });
  });
});

describe("toSummary", () => {
  it("strips HTML, collapses whitespace and drops 'Continue reading'", () => {
    expect(toSummary('<p>Hello <b>world</b></p>\n<p>Again</p> <a href="x">Continue reading...</a>')).toBe(
      "Hello world Again",
    );
  });
  it("truncates on a word boundary with an ellipsis", () => {
    const s = toSummary("word ".repeat(100))!;
    expect(s.length).toBeLessThanOrEqual(280);
    expect(s.endsWith("word…")).toBe(true);
  });
  it("returns null for empty input", () => {
    expect(toSummary(null)).toBeNull();
    expect(toSummary("<p> </p>")).toBeNull();
  });
});

describe("rssIngester.normalize", () => {
  it("normalizes edge-case items: skips bad date/no title, dedupes, keeps no-country items", () => {
    const events = rssIngester.normalize([{ feed: "edge", xml: EDGE_XML }]);
    // Non-URL guids are namespaced by feed.
    expect(events.map((e) => e.external_id)).toEqual(["https://example.com/a?x=1&y=2", "edge:c-guid"]);

    expect(events[0]).toMatchObject({
      source: "rss",
      title: "Floods & landslides kill 12 in Nepal <live>",
      summary: "Rescuers search for missing villagers & livestock.",
      category: "flood",
      severity: 4,
      country: "NP",
      url: "https://example.com/a?x=1&y=2",
      occurred_at: "2026-10-04T08:00:00.000Z",
    });
    expect(events[1]).toMatchObject({
      external_id: "edge:c-guid",
      url: null,
      summary: null,
      country: null,
      lat: null,
      lng: null,
      category: "other",
      severity: 1,
      occurred_at: "2026-10-04T05:00:00.000Z",
    });
  });

  it("normalizes the real feed fixtures", () => {
    const events = rssIngester.normalize(FEEDS);
    expect(events).toHaveLength(10);

    const kyiv = events.find((e) => e.title.startsWith("Kyiv bridge"))!;
    expect(kyiv).toMatchObject({ country: "UA", category: "conflict", lat: 50.45, lng: 30.52 });
    expect(kyiv.raw).toMatchObject({ feed: "bbc" });

    const tigray = events.find((e) => e.title.startsWith("Ethiopian"))!;
    expect(tigray).toMatchObject({ country: "ET", category: "conflict" });

    const brazil = events.find((e) => e.title.startsWith("Brazil votes"))!;
    expect(brazil).toMatchObject({ country: "BR", category: "politics", severity: 2 });

    const libya = events.find((e) => e.title.startsWith("Libyan unity"))!;
    expect(libya.country).toBe("LY");
    expect(libya.summary!.length).toBeLessThanOrEqual(280);
    expect(libya.summary).not.toMatch(/<|&lt;|&amp;/);

    for (const e of events) {
      expect(Number.isNaN(Date.parse(e.occurred_at))).toBe(false);
      expect(e.severity).toBeGreaterThanOrEqual(1);
      expect(e.severity).toBeLessThanOrEqual(5);
    }
  });

  it("ignores malformed raw input", () => {
    expect(rssIngester.normalize([])).toEqual([]);
    expect(rssIngester.normalize([{ feed: "x" } as unknown as RssFeedRaw])).toEqual([]);
    expect(rssIngester.normalize(null as unknown as RssFeedRaw[])).toEqual([]);
  });
});

describe("rssIngester.fetchRaw", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches all feeds in parallel and drops failing ones", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url.includes("bbci")) return new Response(fixture("rss.bbc.xml"), { status: 200 });
        if (url.includes("npr")) return new Response("nope", { status: 503 });
        if (url.includes("guardian")) throw new Error("network down");
        if (url.includes("apnews")) return new Response("rate limited", { status: 429 });
        return new Response(fixture("rss.aljazeera.xml"), { status: 200 });
      }),
    );
    const raw = await rssIngester.fetchRaw();
    expect(raw.map((r) => r.feed)).toEqual(
      RSS_FEEDS.map((f) => f.feed).filter((f) => !["npr", "guardian", "ap"].includes(f)),
    );
    expect(RSS_FEEDS).toHaveLength(15);
  });

  it("configures every feed over https with a unique name", () => {
    expect(new Set(RSS_FEEDS.map((f) => f.feed)).size).toBe(RSS_FEEDS.length);
    for (const f of RSS_FEEDS) expect(f.url.startsWith("https://")).toBe(true);
  });
});

describe("parseFeedDate", () => {
  it("parses RFC 822 and Crisis Group's Drupal format (as UTC)", () => {
    expect(new Date(parseFeedDate("Sun, 4 Oct 2026 14:24:00 GMT")).toISOString()).toBe("2026-10-04T14:24:00.000Z");
    expect(new Date(parseFeedDate("Friday, September 25, 2026 - 15:56")).toISOString()).toBe(
      "2026-09-25T15:56:00.000Z",
    );
    expect(parseFeedDate("not a date")).toBeNaN();
  });
});

describe("cleanTitle", () => {
  it("strips the Google News publisher suffix", () => {
    expect(cleanTitle("Quake hits Japan - Reuters", "Reuters", true)).toBe("Quake hits Japan");
    expect(cleanTitle("Quake hits Japan - AP News", "AP News", true)).toBe("Quake hits Japan");
    // No <source>: Google News feeds still drop the last " - X" segment.
    expect(cleanTitle("Kyiv - a city under fire - AP News", null, true)).toBe("Kyiv - a city under fire");
  });
  it("leaves other titles alone", () => {
    expect(cleanTitle("Kyiv - a city under fire", null)).toBe("Kyiv - a city under fire");
    expect(cleanTitle("Reuters", "Reuters", true)).toBe("Reuters");
  });
});

describe("new feeds", () => {
  const norm = (feed: string, file: string) => rssIngester.normalize([{ feed, xml: fixture(file) }]);

  it("parses DW (opaque numeric guids are namespaced)", () => {
    const events = norm("dw", "rss.dw.xml");
    expect(events).toHaveLength(3);
    expect(events[0]).toMatchObject({
      external_id: "dw:79534734",
      title: "Germany's Merz visits Kyiv as Russia strikes bridge",
      url: "https://www.dw.com/en/germany-s-merz-visits-kyiv-as-russia-strikes-bridge/a-79534734?maca=en-rss-en-all-1573-xml-mrss",
      occurred_at: "2026-10-04T14:24:00.000Z",
    });
    expect(events[0].summary).toMatch(/^As air raid sirens sounded in Kyiv/);
    const spain = events.find((e) => e.title.startsWith("Torrential rain"))!;
    expect(spain).toMatchObject({ country: "ES", category: "flood" });
  });

  it("parses France 24", () => {
    const events = norm("france24", "rss.france24.xml");
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      external_id: "france24:ff58f06e-bffe-11f1-a9b4-214dbeca3573",
      title: 'German Chancellor in Kyiv: "Ukraine will need our support"',
      country: "UA",
      occurred_at: "2026-10-04T14:37:56.000Z",
    });
    expect(events[0].summary).toMatch(/^German Chancellor Friedrich Merz visited Ukraine/);
  });

  it("parses Crisis Group: Drupal dates, drops non-English editions", () => {
    const events = norm("crisisgroup", "rss.crisisgroup.xml");
    expect(events.map((e) => e.title)).toEqual([
      "Updates from the UN General Assembly 2026",
      "Arresting the Dangerous Descent Back into War in Northern Ethiopia",
    ]);
    expect(events[0]).toMatchObject({ external_id: "crisisgroup:28555", occurred_at: "2026-09-25T15:56:00.000Z" });
    expect(events[1]).toMatchObject({ country: "ET", category: "conflict" });
    expect(events.every((e) => !e.url!.includes("/fr/"))).toBe(true);
  });

  it("parses Google News feeds: clean titles, no echo summary, redirect links, newest first", () => {
    const reuters = norm("reuters", "rss.googlenews-reuters.xml");
    expect(reuters.map((e) => e.title)).toEqual([
      "EXCLUSIVE: Saudi Arabia quietly shelving NEOM Stadium, one of 2034 World Cup venues",
      "Trump names intelligence chief Clayton as AI czar, to head task force",
      "AI's race to transform the world before the money runs out",
    ]);
    expect(reuters[0]).toMatchObject({ summary: null, country: "SA", occurred_at: "2026-10-04T08:03:13.000Z" });
    for (const e of reuters) {
      expect(e.external_id).toMatch(/^reuters:CBMi/);
      expect(e.url).toMatch(/^https:\/\/news\.google\.com\/rss\/articles\/.*#publisher=reuters\.com$/);
      expect(e.title).not.toMatch(/ - Reuters$/);
    }

    const ap = norm("ap", "rss.googlenews-ap.xml");
    expect(ap.map((e) => e.title)).toEqual([
      "Daily life around the world, in photos",
      "Heat-trapping gas once frozen in Arctic ground is slowly leaking and warming the planet",
    ]);
    expect(ap.every((e) => e.summary === null && e.external_id.startsWith("ap:"))).toBe(true);
  });

  it(`caps each feed to its newest ${MAX_ITEMS_PER_FEED} items`, () => {
    const items = Array.from(
      { length: 40 },
      (_, i) =>
        `<item><title>Story ${i}</title><link>https://example.com/${i}</link>` +
        `<pubDate>${new Date(Date.UTC(2026, 9, 1, i)).toUTCString()}</pubDate></item>`,
    ).join("");
    const big = `<rss><channel>${items}</channel></rss>`;
    const small = `<rss><channel><item><title>Other</title><link>https://example.org/x</link><pubDate>Sun, 04 Oct 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
    const events = rssIngester.normalize([
      { feed: "big", xml: big },
      { feed: "small", xml: small },
    ]);
    const fromBig = events.filter((e) => e.external_id.startsWith("https://example.com/"));
    expect(fromBig).toHaveLength(MAX_ITEMS_PER_FEED);
    expect(fromBig[0].title).toBe("Story 39");
    expect(fromBig.at(-1)!.title).toBe(`Story ${40 - MAX_ITEMS_PER_FEED}`);
    expect(events.at(-1)!.title).toBe("Other");
  });

  it("dedupes URL guids across feeds (first feed wins) and drops non-http links", () => {
    const a = `<rss><channel><item><title>Shared story</title><guid>https://example.com/shared</guid><link>https://example.com/shared</link><pubDate>Sun, 04 Oct 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
    const b = `<rss><channel>
      <item><title>Shared story again</title><guid>https://example.com/shared</guid><pubDate>Sun, 04 Oct 2026 09:00:00 GMT</pubDate></item>
      <item><title>Same opaque id</title><guid>123</guid><pubDate>Sun, 04 Oct 2026 09:00:00 GMT</pubDate></item>
      <item><title>Script link</title><guid>456</guid><link>javascript:alert(1)</link><pubDate>Sun, 04 Oct 2026 09:00:00 GMT</pubDate></item>
    </channel></rss>`;
    const c = `<rss><channel><item><title>Different feed, same opaque id</title><guid>123</guid><pubDate>Sun, 04 Oct 2026 09:00:00 GMT</pubDate></item></channel></rss>`;
    const events = rssIngester.normalize([
      { feed: "a", xml: a },
      { feed: "b", xml: b },
      { feed: "c", xml: c },
    ]);
    expect(events.map((e) => e.external_id)).toEqual(["https://example.com/shared", "b:123", "b:456", "c:123"]);
    expect(events[0].title).toBe("Shared story");
    expect(events.find((e) => e.external_id === "b:456")!.url).toBeNull();
  });

  it("keeps all fixtures together within the per-feed cap and unique", () => {
    const events = rssIngester.normalize([
      ...FEEDS,
      { feed: "dw", xml: fixture("rss.dw.xml") },
      { feed: "france24", xml: fixture("rss.france24.xml") },
      { feed: "crisisgroup", xml: fixture("rss.crisisgroup.xml") },
      { feed: "reuters", xml: fixture("rss.googlenews-reuters.xml") },
      { feed: "ap", xml: fixture("rss.googlenews-ap.xml") },
    ]);
    expect(events).toHaveLength(10 + 3 + 2 + 2 + 3 + 2);
    expect(new Set(events.map((e) => e.external_id)).size).toBe(events.length);
  });
});

describe("outlet lean", () => {
  it("gives every feed a lean that matches the AllSides table for its domain", () => {
    for (const f of RSS_FEEDS) {
      expect(f).toHaveProperty("lean");
      if (f.lean === null) {
        // Unrated outlets (France 24, Crisis Group) must not be in the table either.
        expect(MEDIA_LEAN[f.domain]).toBeUndefined();
      } else {
        expect(MEDIA_LEANS).toContain(f.lean);
        expect(MEDIA_LEAN[f.domain]?.lean).toBe(f.lean);
      }
    }
  });

  it("covers every lean bucket with at least two feeds", () => {
    for (const lean of MEDIA_LEANS) {
      expect(RSS_FEEDS.filter((f) => f.lean === lean).length, lean).toBeGreaterThanOrEqual(2);
    }
  });

  it("derives each rated feed's lean from its normalized event URLs", () => {
    const cases: [string, string][] = [
      ["guardian", "rss.guardian.xml"],
      ["huffpost", "rss.huffpost.xml"],
      ["vox", "rss.vox.xml"],
      ["npr", "rss.npr.xml"],
      ["aljazeera", "rss.aljazeera.xml"],
      ["ap", "rss.googlenews-ap.xml"],
      ["bbc", "rss.bbc.xml"],
      ["dw", "rss.dw.xml"],
      ["reuters", "rss.googlenews-reuters.xml"],
      ["washtimes", "rss.washtimes.xml"],
      ["washex", "rss.googlenews-washex.xml"],
      ["foxnews", "rss.foxnews.xml"],
      ["nypost", "rss.nypost.xml"],
    ];
    expect(cases).toHaveLength(RSS_FEEDS.filter((f) => f.lean !== null).length);
    for (const [feed, file] of cases) {
      const config = RSS_FEEDS.find((f) => f.feed === feed)!;
      const events = rssIngester.normalize([{ feed, xml: fixture(file) }]);
      expect(events.length, feed).toBeGreaterThan(0);
      for (const e of events) expect(leanForUrl(e.url), `${feed} ${e.url}`).toBe(config.lean);
    }
  });
});

describe("Atom feeds (Vox)", () => {
  it("parses <entry> elements: alternate link, id, published date", () => {
    const items = parseRss(fixture("rss.vox.xml"));
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      title: "America leaves Iraq, again",
      link: "https://www.vox.com/today-explained-newsletter/504742/us-troops-withdraw-iraq",
      guid: "https://www.vox.com/504742/tex-nl-site-template",
      pubDate: "2026-09-30T17:00:00-04:00",
      source: null,
    });
  });

  it("normalizes Vox entries", () => {
    const events = rssIngester.normalize([{ feed: "vox", xml: fixture("rss.vox.xml") }]);
    expect(events).toHaveLength(2);
    expect(events[0]).toMatchObject({
      title: "America leaves Iraq, again",
      url: "https://www.vox.com/today-explained-newsletter/504742/us-troops-withdraw-iraq",
      occurred_at: "2026-09-30T21:00:00.000Z",
    });
    expect(events[0].summary).toMatch(/^This story appeared in/);
    expect(events[0].summary).not.toMatch(/&#160;|</);
  });

  it("falls back to <updated>, <content> and a rel-less <link>", () => {
    const xml = `<feed xmlns="http://www.w3.org/2005/Atom"><link rel="self" href="https://ex.com/feed"/>
      <entry><title>Quake hits Chile</title><link rel="enclosure" href="https://ex.com/a.jpg"/><link href="https://ex.com/a"/>
      <id>tag:ex.com,2026:a</id><updated>2026-10-04T08:00:00Z</updated><content type="html">&lt;p&gt;Body&lt;/p&gt;</content></entry>
    </feed>`;
    const [item] = parseRss(xml);
    expect(item).toMatchObject({
      link: "https://ex.com/a",
      pubDate: "2026-10-04T08:00:00Z",
      description: "<p>Body</p>",
      guid: "tag:ex.com,2026:a",
    });
  });
});

describe("new feed fixtures", () => {
  const norm = (feed: string, file: string) => rssIngester.normalize([{ feed, xml: fixture(file) }]);

  it("parses Washington Times (CDATA links)", () => {
    const events = norm("washtimes", "rss.washtimes.xml");
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe(
      "Hegseth teases removal of U.S. troops from Europe to bolster military presence in Latin America",
    );
    expect(events[0].url).toBe(
      "https://www.washingtontimes.com/news/2026/oct/4/pete-hegseth-teases-removal-us-troops-europe-bolster-military/",
    );
    expect(events[0].summary).toMatch(/^Defense Secretary Pete Hegseth/);
  });

  it("parses Fox News, New York Post and HuffPost", () => {
    const fox = norm("foxnews", "rss.foxnews.xml");
    expect(fox).toHaveLength(2);
    expect(fox.every((e) => e.url!.startsWith("https://www.foxnews.com/world/"))).toBe(true);
    expect(fox[1].title).toBe(
      "US Marine arrested in Japan over suspected killing of woman as Tokyo lodges 'strong protest'",
    );

    const nypost = norm("nypost", "rss.nypost.xml");
    const korea = nypost.find((e) => e.title.startsWith("Never-before-seen images from inside North Korea"))!;
    expect(korea.country).toBe("KP");

    const huff = norm("huffpost", "rss.huffpost.xml");
    expect(huff).toHaveLength(2);
    expect(huff[0].external_id).toBe(
      "https://www.huffpost.com/entry/strait-of-hormuz-closure_n_6ac24247e4b0bc90e3ff8ae5",
    );
  });

  it("parses the Washington Examiner Google News feed and tags its publisher", () => {
    expect(parseRss(fixture("rss.googlenews-washex.xml"))[0].sourceUrl).toBe("https://www.washingtonexaminer.com");
    const events = norm("washex", "rss.googlenews-washex.xml");
    expect(events).toHaveLength(2);
    expect(events[0].title).toBe(
      "Arab parties set up for kingmaker role in Israeli election despite Netanyahu’s move to ban them",
    );
    for (const e of events) {
      expect(e.external_id).toMatch(/^washex:CBMi/);
      expect(e.url).toMatch(/^https:\/\/news\.google\.com\/rss\/articles\/.+\?oc=5#publisher=washingtonexaminer\.com$/);
      expect(e.summary).toBeNull();
    }
  });

  it("falls back to the configured domain when a Google News item has no <source url>", () => {
    const xml = `<rss><channel><item><title>Story - Reuters</title><link>https://news.google.com/rss/articles/abc?oc=5</link>
      <guid>abc</guid><pubDate>Sun, 04 Oct 2026 08:00:00 GMT</pubDate></item></channel></rss>`;
    const [e] = rssIngester.normalize([{ feed: "reuters", xml }]);
    expect(e.url).toBe("https://news.google.com/rss/articles/abc?oc=5#publisher=reuters.com");
    expect(leanForUrl(e.url)).toBe("center");
  });
});

describe("per-lean balance", () => {
  const many = (domain: string, n: number) =>
    `<rss><channel>${Array.from(
      { length: n },
      (_, i) =>
        `<item><title>${domain} story ${i}</title><link>https://www.${domain}/${i}</link>` +
        `<pubDate>${new Date(Date.UTC(2026, 9, 1, 0, i)).toUTCString()}</pubDate></item>`,
    ).join("")}</channel></rss>`;

  it("splits each bucket's budget between the feeds present", () => {
    const caps = feedCaps(["guardian", "huffpost", "vox", "npr", "foxnews", "france24", "crisisgroup", "unknown"]);
    expect(caps.get("guardian")).toBe(Math.floor(MAX_ITEMS_PER_LEAN / 3));
    expect(caps.get("vox")).toBe(Math.floor(MAX_ITEMS_PER_LEAN / 3));
    // Alone in its bucket this run: only the per-feed cap applies.
    expect(caps.get("npr")).toBe(MAX_ITEMS_PER_FEED);
    expect(caps.get("foxnews")).toBe(MAX_ITEMS_PER_FEED);
    // Unrated feeds share their own bucket; unconfigured feeds get the plain per-feed cap.
    expect(caps.get("france24")).toBe(Math.min(MAX_ITEMS_PER_FEED, Math.floor(MAX_ITEMS_PER_LEAN / 2)));
    expect(caps.get("unknown")).toBe(MAX_ITEMS_PER_FEED);
  });

  it("keeps every bucket within MAX_ITEMS_PER_LEAN in a full run", () => {
    const raw: RssFeedRaw[] = RSS_FEEDS.filter((f) => !f.googleNews).map((f) => ({
      feed: f.feed,
      xml: many(f.domain, 60),
    }));
    const events = rssIngester.normalize(raw);
    const byBucket = new Map<string, number>();
    for (const e of events) {
      const lean = leanForUrl(e.url) ?? "unrated";
      byBucket.set(lean, (byBucket.get(lean) ?? 0) + 1);
    }
    expect(byBucket.size).toBe(MEDIA_LEANS.length + 1);
    for (const [bucket, n] of byBucket) expect(n, bucket).toBeLessThanOrEqual(MAX_ITEMS_PER_LEAN);
    // Left has 3 feeds and right 2, yet both contribute about the same number of stories.
    expect(Math.abs(byBucket.get("left")! - byBucket.get("right")!)).toBeLessThanOrEqual(2);
  });
});
