"use client";

import { memo } from "react";
import { formatDistanceStrict } from "date-fns";
import { CATEGORY_META } from "@/lib/categories";
import type { EventRow } from "@/lib/types";
import { FOCUS_RING, SOURCE_LABEL } from "./labels";
import { SeverityPips } from "./severity-pips";

/** Relative time against an explicit `now`, so server and client render the same string. */
export function relativeTime(iso: string, now: number): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "unknown time";
  if (now - t < 60_000) return "just now";
  return formatDistanceStrict(t, now, { addSuffix: true });
}

export const EventCard = memo(function EventCard({
  event,
  now,
  selected,
  fresh,
  onSelect,
}: {
  event: EventRow;
  now: number;
  selected: boolean;
  fresh: boolean;
  onSelect: (id: number) => void;
}) {
  const meta = CATEGORY_META[event.category];
  return (
    <button
      type="button"
      data-event-id={event.id}
      aria-pressed={selected}
      onClick={() => onSelect(event.id)}
      className={`group relative flex w-full gap-3 border-b border-border py-2.5 pl-4 pr-3 text-left transition-colors duration-1000 ${FOCUS_RING} focus-visible:ring-inset ${
        selected ? "bg-surface-2" : fresh ? "bg-accent/10" : "hover:bg-surface-2/60"
      }`}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1"
        style={{ backgroundColor: meta.color }}
      />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-sm leading-snug text-foreground">{event.title}</span>
        <span className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-muted">
          <span style={{ color: meta.color }}>{meta.label}</span>
          <time dateTime={event.occurred_at} suppressHydrationWarning>
            {relativeTime(event.occurred_at, now)}
          </time>
          <span className="font-mono">{SOURCE_LABEL[event.source]}</span>
          {event.country && <span className="font-mono">{event.country}</span>}
          {fresh && <span className="font-mono uppercase tracking-wider text-accent">new</span>}
        </span>
      </span>
      <SeverityPips severity={event.severity} className="mt-1 shrink-0" />
    </button>
  );
});
