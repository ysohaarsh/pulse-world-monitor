import { z } from "zod";
import type { NormalizedEvent } from "@/lib/types";
import { classify } from "./classify";
import { countryByName, detectCountry } from "./geo";
import type { Ingester } from "./types";

const QUERY = "(conflict OR protest OR disaster OR election OR outbreak) sourcelang:english";

export const GDELT_URL =
  "https://api.gdeltproject.org/api/v2/doc/doc?" +
  new URLSearchParams({
    query: QUERY,
    mode: "artlist",
    format: "json",
    maxrecords: "75",
    timespan: "1h",
    sort: "datedesc",
  }).toString();

const articleSchema = z.object({
  url: z.string().url(),
  title: z.string().trim().min(1),
  seendate: z.string(),
  domain: z.string().optional(),
  sourcecountry: z.string().optional(),
  language: z.string().optional(),
});

export interface GdeltRaw {
  articles: unknown[];
}

/** "20261004T101500Z" → "2026-10-04T10:15:00.000Z"; null if malformed. */
export function parseSeenDate(s: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(s.trim());
  if (!m) return null;
  const [, y, mo, d, h, mi, se] = m.map(Number);
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi, se));
  // Reject rollovers like month 13 / day 32.
  if (date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString();
}

/** Parse a GDELT response body. GDELT answers rate limits with a 200 + plain-text notice. */
export function parseGdeltBody(body: string): GdeltRaw {
  try {
    const json: unknown = JSON.parse(body);
    if (json && typeof json === "object" && Array.isArray((json as GdeltRaw).articles)) {
      return { articles: (json as GdeltRaw).articles };
    }
  } catch {
    // empty body / rate-limit text / truncated JSON
  }
  return { articles: [] };
}

export const gdeltIngester: Ingester<GdeltRaw> = {
  source: "gdelt",

  async fetchRaw() {
    const res = await fetch(GDELT_URL, { signal: AbortSignal.timeout(15_000), cache: "no-store" });
    if (res.status === 429) return { articles: [] };
    if (!res.ok) throw new Error(`GDELT HTTP ${res.status}`);
    return parseGdeltBody(await res.text());
  },

  normalize(raw) {
    const articles = raw && Array.isArray(raw.articles) ? raw.articles : [];
    const seen = new Set<string>();
    const out: NormalizedEvent[] = [];
    for (const item of articles) {
      const parsed = articleSchema.safeParse(item);
      if (!parsed.success) continue;
      const a = parsed.data;
      const occurred_at = parseSeenDate(a.seendate);
      if (!occurred_at || seen.has(a.url)) continue;
      seen.add(a.url);

      const geo = detectCountry(a.title) ?? countryByName(a.sourcecountry);
      const { category, severity } = classify(a.title);
      out.push({
        source: "gdelt",
        external_id: a.url,
        title: a.title,
        summary: a.domain ? `via ${a.domain}` : null,
        category,
        severity,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        country: geo?.country ?? null,
        url: a.url,
        occurred_at,
        raw: item,
      });
    }
    return out;
  },
};
