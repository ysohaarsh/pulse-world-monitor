import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { decodeEntities, parseRss, RSS_FEEDS, rssIngester, toSummary, type RssFeedRaw } from "./rss";

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
    expect(events.map((e) => e.external_id)).toEqual(["https://example.com/a?x=1&y=2", "c-guid"]);

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
      external_id: "c-guid",
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
        return new Response(fixture("rss.aljazeera.xml"), { status: 200 });
      }),
    );
    const raw = await rssIngester.fetchRaw();
    expect(raw.map((r) => r.feed)).toEqual(["bbc", "aljazeera"]);
    expect(RSS_FEEDS).toHaveLength(4);
  });
});
