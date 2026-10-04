import { CATEGORIES, SOURCES, type Category, type EventRow, type Severity, type Source } from "@/lib/types";

export const TIME_WINDOWS = ["1h", "6h", "24h", "7d"] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

export const WINDOW_MS: Record<TimeWindow, number> = {
  "1h": 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
};

export interface EventFilters {
  /** Categories to include. Never empty — "all" is every category. */
  categories: Category[];
  /** Sources to include. Never empty — "all" is every source. */
  sources: Source[];
  minSeverity: Severity;
  window: TimeWindow;
}

export const DEFAULT_FILTERS: EventFilters = {
  categories: [...CATEGORIES],
  sources: [...SOURCES],
  minSeverity: 1,
  window: "24h",
};

/** URL search param keys. Kept short so shared links stay readable. */
const KEYS = { categories: "cat", sources: "src", minSeverity: "sev", window: "win" } as const;

type RawParams =
  | URLSearchParams
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

function getParam(params: RawParams, key: string): string | undefined {
  if (!params) return undefined;
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const v = params[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Parses a comma-separated allow-list; unknown values are dropped, empty/missing → all, in canonical order. */
function parseList<T extends string>(raw: string | undefined, all: readonly T[]): T[] {
  if (raw === undefined) return [...all];
  const wanted = new Set(raw.split(",").map((s) => s.trim().toLowerCase()));
  const picked = all.filter((v) => wanted.has(v));
  return picked.length > 0 ? picked : [...all];
}

/** Parse filters from URL search params (Next `searchParams` object or `URLSearchParams`). Never throws. */
export function parseFilters(params: RawParams): EventFilters {
  const sevRaw = Number.parseInt(getParam(params, KEYS.minSeverity) ?? "", 10);
  const minSeverity = (
    Number.isFinite(sevRaw) ? Math.min(5, Math.max(1, sevRaw)) : DEFAULT_FILTERS.minSeverity
  ) as Severity;

  const winRaw = getParam(params, KEYS.window);
  const window = (TIME_WINDOWS as readonly string[]).includes(winRaw ?? "")
    ? (winRaw as TimeWindow)
    : DEFAULT_FILTERS.window;

  return {
    categories: parseList(getParam(params, KEYS.categories), CATEGORIES),
    sources: parseList(getParam(params, KEYS.sources), SOURCES),
    minSeverity,
    window,
  };
}

function isAll<T>(selected: readonly T[], all: readonly T[]): boolean {
  return all.every((v) => selected.includes(v));
}

/** Serialize filters to search params, omitting anything equal to the default so URLs stay short. */
export function serializeFilters(filters: EventFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (!isAll(filters.categories, CATEGORIES)) {
    params.set(KEYS.categories, CATEGORIES.filter((c) => filters.categories.includes(c)).join(","));
  }
  if (!isAll(filters.sources, SOURCES)) {
    params.set(KEYS.sources, SOURCES.filter((s) => filters.sources.includes(s)).join(","));
  }
  if (filters.minSeverity !== DEFAULT_FILTERS.minSeverity) {
    params.set(KEYS.minSeverity, String(filters.minSeverity));
  }
  if (filters.window !== DEFAULT_FILTERS.window) params.set(KEYS.window, filters.window);
  return params;
}

/** Stable string key for a filter set (useful for memo/effect deps). */
export function filtersKey(filters: EventFilters): string {
  return serializeFilters(filters).toString();
}

/** Earliest `occurred_at` (ms epoch) included by the filter's time window. */
export function windowStart(filters: EventFilters, now: number): number {
  return now - WINDOW_MS[filters.window];
}

/** Pure predicate shared by the client (realtime inserts, local re-filtering) and tests. */
export function matchesFilters(
  event: Pick<EventRow, "category" | "source" | "severity" | "occurred_at">,
  filters: EventFilters,
  now: number | Date,
): boolean {
  const nowMs = typeof now === "number" ? now : now.getTime();
  if (!filters.categories.includes(event.category)) return false;
  if (!filters.sources.includes(event.source)) return false;
  if (event.severity < filters.minSeverity) return false;
  const t = Date.parse(event.occurred_at);
  if (Number.isNaN(t)) return false;
  return t >= windowStart(filters, nowMs);
}

/** Toggle membership of `value`; toggling off the last remaining value resets to "all". */
export function toggleValue<T extends string>(selected: readonly T[], value: T, all: readonly T[]): T[] {
  const next = selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value];
  return next.length === 0 ? [...all] : all.filter((v) => next.includes(v));
}
