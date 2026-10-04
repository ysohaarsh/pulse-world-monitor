/**
 * Outlet political lean, from AllSides Media Bias Ratings (https://www.allsides.com/media-bias/ratings).
 * Ratings describe the outlet's online news coverage as a whole, not any single story.
 *
 * Events have no lean column, so the UI derives lean from the event's `url` at render time.
 * Google News items link via `news.google.com` redirects, so the RSS ingester appends the
 * publisher's domain as a URL fragment (`#publisher=reuters.com`, see `withPublisher`). Fragments
 * never reach the server, so the redirect link keeps working.
 */

export const MEDIA_LEANS = ["left", "lean-left", "center", "lean-right", "right"] as const;
export type MediaLean = (typeof MEDIA_LEANS)[number];

export interface LeanMeta {
  /** Compact badge text. */
  code: string;
  /** Human label, e.g. "lean left". */
  label: string;
  /** 0 (left) … 4 (right): which segment of the 5-cell bar is lit. */
  position: number;
}

export const LEAN_META: Record<MediaLean, LeanMeta> = {
  left: { code: "L", label: "left", position: 0 },
  "lean-left": { code: "LL", label: "lean left", position: 1 },
  center: { code: "C", label: "center", position: 2 },
  "lean-right": { code: "LR", label: "lean right", position: 3 },
  right: { code: "R", label: "right", position: 4 },
};

export interface OutletLean {
  outlet: string;
  lean: MediaLean;
  /** The outlet's AllSides rating page. */
  allsides: string;
}

const AS = "https://www.allsides.com/news-source/";

const BBC: OutletLean = { outlet: "BBC News", lean: "center", allsides: `${AS}bbc-news-media-bias` };

/** Registrable domain → outlet. Subdomains (www., edition., …) resolve to their parent. */
export const MEDIA_LEAN: Readonly<Record<string, OutletLean>> = {
  "theguardian.com": { outlet: "The Guardian", lean: "left", allsides: `${AS}guardian-media-bias` },
  "huffpost.com": { outlet: "HuffPost", lean: "left", allsides: `${AS}huffpost-media-bias` },
  "vox.com": { outlet: "Vox", lean: "left", allsides: `${AS}vox-news-media-bias` },
  "npr.org": { outlet: "NPR", lean: "lean-left", allsides: `${AS}npr-media-bias` },
  "aljazeera.com": { outlet: "Al Jazeera", lean: "lean-left", allsides: `${AS}al-jazeera-media-bias` },
  "apnews.com": { outlet: "Associated Press", lean: "lean-left", allsides: `${AS}associated-press-media-bias` },
  "bbc.co.uk": BBC,
  "bbc.com": BBC,
  "reuters.com": { outlet: "Reuters", lean: "center", allsides: `${AS}reuters-media-bias` },
  "dw.com": { outlet: "Deutsche Welle", lean: "center", allsides: `${AS}deutsche-welle-media-bias` },
  "washingtontimes.com": {
    outlet: "The Washington Times",
    lean: "lean-right",
    allsides: `${AS}washington-times-media-bias`,
  },
  "washingtonexaminer.com": {
    outlet: "Washington Examiner",
    lean: "lean-right",
    allsides: `${AS}washington-examiner-media-bias`,
  },
  "foxnews.com": { outlet: "Fox News", lean: "right", allsides: `${AS}fox-news-media-bias` },
  "nypost.com": { outlet: "New York Post", lean: "right", allsides: `${AS}new-york-post-news-media-bias` },
};

const PUBLISHER_PARAM = "publisher";
const GOOGLE_NEWS_HOST = "news.google.com";

function parseUrl(url: string | null | undefined): URL | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u : null;
  } catch {
    return null;
  }
}

/** Bare host of a URL or hostname ("https://www.Reuters.com/x" → "reuters.com"), or null. */
export function domainOf(urlOrHost: string | null | undefined): string | null {
  if (!urlOrHost) return null;
  const u = parseUrl(/^[a-z][a-z0-9+.-]*:\/\//i.test(urlOrHost) ? urlOrHost : `https://${urlOrHost}`);
  return u ? u.hostname.toLowerCase().replace(/^www\./, "") : null;
}

function lookupHost(host: string): OutletLean | null {
  const parts = host.toLowerCase().split(".");
  // "edition.cnn.com" → "edition.cnn.com", "cnn.com" (never a bare TLD).
  for (let i = 0; i < parts.length - 1; i++) {
    const hit = MEDIA_LEAN[parts.slice(i).join(".")];
    if (hit) return hit;
  }
  return null;
}

/**
 * Tag a Google News redirect link with its publisher's domain (`#publisher=reuters.com`), so the
 * outlet can be recovered from the stored `url` alone. Other links are returned unchanged.
 */
export function withPublisher(link: string, publisherUrl: string | null | undefined): string {
  const u = parseUrl(link);
  const domain = domainOf(publisherUrl);
  if (!u || !domain || u.hostname !== GOOGLE_NEWS_HOST) return link;
  u.hash = `${PUBLISHER_PARAM}=${domain}`;
  return u.toString();
}

/** The outlet behind an article URL (Google News links via their `#publisher=` tag), or null. */
export function outletForUrl(url: string | null | undefined): OutletLean | null {
  const u = parseUrl(url);
  if (!u) return null;
  if (u.hostname === GOOGLE_NEWS_HOST) {
    const publisher = new URLSearchParams(u.hash.slice(1)).get(PUBLISHER_PARAM);
    return publisher ? lookupHost(publisher) : null;
  }
  return lookupHost(u.hostname);
}

export function leanForUrl(url: string | null | undefined): MediaLean | null {
  return outletForUrl(url)?.lean ?? null;
}

/** "The Guardian — left (AllSides)": used for tooltips and aria-labels. */
export function leanDescription(o: OutletLean): string {
  return `${o.outlet} — ${LEAN_META[o.lean].label} (AllSides)`;
}
