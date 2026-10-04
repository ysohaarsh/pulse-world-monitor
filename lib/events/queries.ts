import "server-only";
import { CATEGORIES, SOURCES, type EventRow } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { type EventFilters, windowStart } from "./filters";
import { EVENT_COLUMNS, toEventRow } from "./row";

export const EVENTS_LIMIT = 500;

export interface RecentEventsResult {
  events: EventRow[];
  /** Human-readable error when the query failed; the page still renders with an empty list. */
  error: string | null;
}

/** Most recent events matching `filters`, newest first. Server-only (uses the per-request client). */
export async function getRecentEvents(
  filters: EventFilters,
  now: number = Date.now(),
): Promise<RecentEventsResult> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("events")
      .select(EVENT_COLUMNS)
      .gte("occurred_at", new Date(windowStart(filters, now)).toISOString())
      .gte("severity", filters.minSeverity)
      .order("occurred_at", { ascending: false })
      .limit(EVENTS_LIMIT);

    if (filters.categories.length < CATEGORIES.length) query = query.in("category", filters.categories);
    if (filters.sources.length < SOURCES.length) query = query.in("source", filters.sources);

    const { data, error } = await query;
    if (error) {
      console.error("[events] getRecentEvents failed:", error.message);
      return { events: [], error: "Couldn't load events right now." };
    }
    const events = (data ?? []).map(toEventRow).filter((e): e is EventRow => e !== null);
    return { events, error: null };
  } catch (err) {
    console.error("[events] getRecentEvents threw:", err);
    return { events: [], error: "Couldn't connect to the events database." };
  }
}

/** Data for the home page: filters → events, plus the server clock used for SSR-stable relative times. */
export async function loadHomeEvents(filters: EventFilters): Promise<RecentEventsResult & { now: number }> {
  const now = Date.now();
  return { ...(await getRecentEvents(filters, now)), now };
}
