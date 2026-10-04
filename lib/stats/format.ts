// Small display helpers shared by /stats and /brief.

let regionNames: Intl.DisplayNames | null = null;

/** ISO 3166-1 alpha-2 → English name; falls back to the raw code. */
export function countryName(code: string): string {
  try {
    regionNames ??= new Intl.DisplayNames(["en"], { type: "region" });
    return regionNames.of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

const UTC_DATETIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const UTC_DATE = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });

/** e.g. "4 Oct 2026, 12:34 UTC" — deterministic on server and client. */
export function formatUtc(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : `${UTC_DATETIME.format(d)} UTC`;
}

export function formatUtcDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : UTC_DATE.format(d);
}

export const SOURCE_LABELS: Record<string, string> = {
  usgs: "USGS",
  eonet: "NASA EONET",
  gdelt: "GDELT",
  rss: "News RSS",
};
