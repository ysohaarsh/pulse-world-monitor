import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/database.types";
import type { EventRow } from "@/lib/types";

export type BriefRow = Pick<
  Tables<"briefs">,
  "id" | "period_start" | "period_end" | "content" | "model" | "created_at"
>;
export type BriefArchiveItem = Pick<BriefRow, "id" | "period_start" | "period_end" | "created_at">;
export type TopEvent = Pick<
  EventRow,
  "id" | "title" | "category" | "severity" | "occurred_at" | "url" | "country" | "source"
>;

const ARCHIVE_SIZE = 7;

export interface BriefPageData {
  brief: BriefRow | null;
  /** Up to 7 world briefs other than the one shown, newest first. */
  archive: BriefArchiveItem[];
  error: string | null;
}

/** Load the selected (or latest) world brief plus the archive of previous ones. */
export async function fetchWorldBriefs(selectedId: number | null): Promise<BriefPageData> {
  try {
    const supabase = await createClient();
    const { data: list, error } = await supabase
      .from("briefs")
      .select("id, period_start, period_end, created_at")
      .eq("scope", "world")
      .order("period_start", { ascending: false })
      .limit(ARCHIVE_SIZE + 1);
    if (error) return { brief: null, archive: [], error: error.message };
    const rows = list ?? [];
    const targetId = selectedId ?? rows[0]?.id ?? null;
    if (targetId === null) return { brief: null, archive: [], error: null };

    const { data: brief, error: briefError } = await supabase
      .from("briefs")
      .select("id, period_start, period_end, content, model, created_at")
      .eq("scope", "world")
      .eq("id", targetId)
      .maybeSingle();
    if (briefError) return { brief: null, archive: rows, error: briefError.message };

    const archive = rows.filter((r) => r.id !== targetId).slice(0, ARCHIVE_SIZE);
    return { brief: brief ?? null, archive, error: null };
  } catch (e) {
    return { brief: null, archive: [], error: e instanceof Error ? e.message : "Unknown error" };
  }
}

/** The 10 most severe events in [start, end], most recent first within a severity level. */
export async function fetchTopEvents(
  start: string,
  end: string,
  limit = 10,
): Promise<{ events: TopEvent[]; error: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("events")
      .select("id, title, category, severity, occurred_at, url, country, source")
      .gte("occurred_at", start)
      .lte("occurred_at", end)
      .order("severity", { ascending: false })
      .order("occurred_at", { ascending: false })
      .limit(limit);
    if (error) return { events: [], error: error.message };
    return { events: (data ?? []) as TopEvent[], error: null };
  } catch (e) {
    return { events: [], error: e instanceof Error ? e.message : "Unknown error" };
  }
}
