"use client";

import { CATEGORY_META } from "@/lib/categories";
import { CATEGORIES, SOURCES, type Severity } from "@/lib/types";
import { type EventFilters, TIME_WINDOWS, toggleValue } from "@/lib/events/filters";
import { FOCUS_RING, SOURCE_LABEL, WINDOW_LABEL } from "./labels";

const CHIP =
  "inline-flex items-center gap-1.5 border px-1.5 py-0.5 text-[10px] uppercase tracking-wider transition-colors " +
  FOCUS_RING;

function chipState(pressed: boolean) {
  return pressed
    ? "border-border-strong bg-accent/10 text-foreground"
    : "border-border bg-transparent text-muted opacity-50 hover:opacity-100";
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
    <div className="flex flex-col gap-2 border-b border-border bg-background/40 px-3 py-2.5">
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
                className="h-1.5 w-1.5"
                style={{
                  backgroundColor: CATEGORY_META[c].color,
                  boxShadow: pressed ? `0 0 5px ${CATEGORY_META[c].color}` : undefined,
                }}
              />
              {CATEGORY_META[c].label}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Time window" className="inline-flex overflow-hidden border border-border-strong">
          {TIME_WINDOWS.map((w) => {
            const pressed = filters.window === w;
            return (
              <button
                key={w}
                type="button"
                aria-pressed={pressed}
                aria-label={`Last ${WINDOW_LABEL[w]}`}
                onClick={() => onChange({ ...filters, window: w })}
                className={`px-2 py-0.5 text-[10px] uppercase ${FOCUS_RING} ${
                  pressed ? "bg-accent font-bold text-black" : "text-muted hover:text-accent"
                }`}
              >
                {WINDOW_LABEL[w]}
              </button>
            );
          })}
        </div>

        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted">
          <span>Sev</span>
          <select
            value={filters.minSeverity}
            onChange={(e) => onChange({ ...filters, minSeverity: Number(e.target.value) as Severity })}
            className={`border border-border-strong bg-background px-1.5 py-0.5 text-[10px] text-accent ${FOCUS_RING}`}
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
        <span className="text-[10px] uppercase tracking-wider text-muted">Src</span>
        {SOURCES.map((s) => {
          const pressed = filters.sources.includes(s);
          return (
            <button
              key={s}
              type="button"
              aria-pressed={pressed}
              onClick={() => onChange({ ...filters, sources: toggleValue(filters.sources, s, SOURCES) })}
              className={`${CHIP} ${chipState(pressed)}`}
            >
              {SOURCE_LABEL[s]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
