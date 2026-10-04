"use client";

import { CATEGORY_META } from "@/lib/categories";
import { CATEGORIES, SOURCES, type Severity } from "@/lib/types";
import { type EventFilters, TIME_WINDOWS, toggleValue } from "@/lib/events/filters";
import { FOCUS_RING, SOURCE_LABEL, WINDOW_LABEL } from "./labels";

const CHIP =
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] transition-colors " + FOCUS_RING;

function chipState(pressed: boolean) {
  return pressed
    ? "border-border bg-surface-2 text-foreground"
    : "border-border/60 bg-transparent text-muted opacity-60 hover:opacity-100";
}

export function FilterBar({
  filters,
  onChange,
}: {
  filters: EventFilters;
  onChange: (next: EventFilters) => void;
}) {
  const allCategories = filters.categories.length === CATEGORIES.length;

  return (
    <div className="flex flex-col gap-2.5 border-b border-border px-3 py-3">
      <div role="group" aria-label="Categories" className="flex flex-wrap gap-1.5">
        <button
          type="button"
          aria-pressed={allCategories}
          onClick={() => onChange({ ...filters, categories: [...CATEGORIES] })}
          className={`${CHIP} ${chipState(allCategories)}`}
        >
          All
        </button>
        {CATEGORIES.map((c) => {
          const pressed = filters.categories.includes(c);
          return (
            <button
              key={c}
              type="button"
              aria-pressed={pressed}
              aria-label={`${CATEGORY_META[c].label} events`}
              onClick={() => onChange({ ...filters, categories: toggleValue(filters.categories, c, CATEGORIES) })}
              className={`${CHIP} ${chipState(pressed)}`}
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: CATEGORY_META[c].color }}
              />
              {CATEGORY_META[c].label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Time window" className="inline-flex overflow-hidden rounded-md border border-border">
          {TIME_WINDOWS.map((w) => {
            const pressed = filters.window === w;
            return (
              <button
                key={w}
                type="button"
                aria-pressed={pressed}
                aria-label={`Last ${WINDOW_LABEL[w]}`}
                onClick={() => onChange({ ...filters, window: w })}
                className={`px-2 py-1 font-mono text-[11px] ${FOCUS_RING} ${
                  pressed ? "bg-accent/15 text-accent" : "text-muted hover:text-foreground"
                }`}
              >
                {WINDOW_LABEL[w]}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-1 text-[11px] text-muted">
          <span>Severity</span>
          <select
            value={filters.minSeverity}
            onChange={(e) => onChange({ ...filters, minSeverity: Number(e.target.value) as Severity })}
            className={`rounded-md border border-border bg-surface-2 px-1.5 py-1 text-[11px] text-foreground ${FOCUS_RING}`}
          >
            <option value={1}>Any</option>
            <option value={2}>2+</option>
            <option value={3}>3+</option>
            <option value={4}>4+</option>
            <option value={5}>5 only</option>
          </select>
        </label>
      </div>

      <div role="group" aria-label="Sources" className="flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] text-muted">Sources</span>
        {SOURCES.map((s) => {
          const pressed = filters.sources.includes(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={pressed}
              onClick={() => onChange({ ...filters, sources: toggleValue(filters.sources, s, SOURCES) })}
              className={`${CHIP} ${chipState(pressed)} font-mono`}
            >
              {SOURCE_LABEL[s]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
