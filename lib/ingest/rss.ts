import { z } from "zod";
import type { NormalizedEvent } from "@/lib/types";
import { classify } from "./classify";
import { detectCountry } from "./geo";
import type { Ingester } from "./types";

export const RSS_FEEDS = [
  { feed: "bbc", url: "https://feeds.bbci.co.uk/news/world/rss.xml" },
  { feed: "aljazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { feed: "npr", url: "https://feeds.npr.org/1004/rss.xml" },
  { feed: "guardian", url: "https://www.theguardian.com/world/rss" },
] as const;

export interface RssFeedRaw {
  feed: string;
  xml: string;
}

export interface RssItem {
  title: string | null;
  link: string | null;
  description: string | null;
  pubDate: string | null;
  guid: string | null;
}

const SUMMARY_MAX = 280;

// ---------- minimal RSS 2.0 parsing ----------

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
};

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, ent: string) => {
    if (ent[0] === "#") {
      const code = ent[1] === "x" || ent[1] === "X" ? parseInt(ent.slice(2), 16) : parseInt(ent.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED_ENTITIES[ent.toLowerCase()] ?? whole;
  });
}

/** Text content of an element: CDATA sections are taken verbatim, the rest entity-decoded. */
function textContent(inner: string): string {
  let out = "";
  let last = 0;
  for (const m of inner.matchAll(/<!\[CDATA\[([\s\S]*?)\]\]>/g)) {
    out += decodeEntities(inner.slice(last, m.index)) + m[1];
    last = m.index + m[0].length;
  }
  out += decodeEntities(inner.slice(last));
  return out.trim();
}

function tag(block: string, name: string): string | null {
  // `<name` followed by space, `>` or `/` — so `<link` never matches `<atom:link`, and
  // `<title` never matches `<media:title`.
  const m = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i").exec(block);
  if (!m) return null;
  const v = textContent(m[1]);
  return v === "" ? null : v;
}

export function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  for (const m of xml.matchAll(/<item(?:\s[^>]*)?>([\s\S]*?)<\/item>/gi)) {
    const block = m[1];
    items.push({
      title: tag(block, "title"),
      link: tag(block, "link"),
      description: tag(block, "description"),
      pubDate: tag(block, "pubDate"),
      guid: tag(block, "guid"),
    });
  }
  return items;
}

/** Strip HTML tags, decode entities, collapse whitespace, truncate on a word boundary. */
export function toSummary(html: string | null, max = SUMMARY_MAX): string | null {
  if (!html) return null;
  const text = decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<a\b[^>]*>\s*Continue reading\.*\s*<\/a>/gi, " ")
      .replace(/<[^>]+>/g, " "),
  )
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  const sp = cut.lastIndexOf(" ");
  return (sp > max * 0.6 ? cut.slice(0, sp) : cut).replace(/[\s,;:.]+$/, "") + "…";
}

// ---------- ingester ----------

const feedSchema = z.object({ feed: z.string(), xml: z.string() });

const itemSchema = z
  .object({
    title: z.string().min(1),
    link: z.string().url().nullable(),
    description: z.string().nullable(),
    pubDate: z.string().min(1),
    guid: z.string().min(1).nullable(),
  })
  .refine((i) => i.guid !== null || i.link !== null, "needs guid or link");

export const rssIngester: Ingester<RssFeedRaw[]> = {
  source: "rss",

  async fetchRaw() {
    const results = await Promise.allSettled(
      RSS_FEEDS.map(async ({ feed, url }) => {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          cache: "no-store",
          headers: { "User-Agent": "PulseBot/1.0 (+world events dashboard)" },
        });
        if (!res.ok) throw new Error(`${feed} RSS HTTP ${res.status}`);
        return { feed, xml: await res.text() };
      }),
    );
    return results.flatMap((r) => (r.status === "fulfilled" ? [r.value] : []));
  },

  normalize(raw) {
    const feeds = Array.isArray(raw) ? raw : [];
    const seen = new Set<string>();
    const out: NormalizedEvent[] = [];
    for (const f of feeds) {
      const feed = feedSchema.safeParse(f);
      if (!feed.success) continue;
      for (const rawItem of parseRss(feed.data.xml)) {
        const parsed = itemSchema.safeParse(rawItem);
        if (!parsed.success) continue;
        const item = parsed.data;
        const time = Date.parse(item.pubDate);
        if (Number.isNaN(time)) continue;
        const external_id = (item.guid ?? item.link) as string;
        if (seen.has(external_id)) continue;
        seen.add(external_id);

        const summary = toSummary(item.description);
        const text = `${item.title}. ${summary ?? ""}`;
        // Prefer the headline's country; fall back to the summary.
        const geo = detectCountry(item.title) ?? detectCountry(summary);
        const { category, severity } = classify(text);
        out.push({
          source: "rss",
          external_id,
          title: item.title,
          summary,
          category,
          severity,
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
          country: geo?.country ?? null,
          url: item.link,
          occurred_at: new Date(time).toISOString(),
          raw: { feed: feed.data.feed, ...item },
        });
      }
    }
    return out;
  },
};
