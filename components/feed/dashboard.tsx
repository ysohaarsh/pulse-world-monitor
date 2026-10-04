"use client";

import { useCallback, useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { EventRow } from "@/lib/types";
import { DEFAULT_FILTERS, type EventFilters, filtersKey, matchesFilters, serializeFilters } from "@/lib/events/filters";
import { useLiveEvents } from "@/lib/events/use-live-events";
import { MapView } from "@/components/map/map-view";
import type { FlyTarget } from "@/components/map/event-map";
import { EventDrawer } from "./event-drawer";
import { EventList } from "./event-list";
import { FilterBar } from "./filter-bar";
import { LiveIndicator } from "./live-indicator";

const TICK_MS = 30_000;

/** Current time that re-renders periodically; starts at the server's clock so SSR and hydration agree. */
function useNow(initial: number): number {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);
  return now;
}

type Selection = { id: number; origin: "map" | "feed" };

export function Dashboard({
  initialEvents,
  filters,
  serverNow,
  error,
}: {
  initialEvents: EventRow[];
  filters: EventFilters;
  serverNow: number;
  error: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  // Filters apply locally right away; the server refetch lands when the transition completes.
  const [activeFilters, setActiveFilters] = useOptimistic(filters);
  const { events, freshIds, status } = useLiveEvents(initialEvents, activeFilters);
  const now = useNow(serverNow);

  const visible = useMemo(
    () => events.filter((e) => matchesFilters(e, activeFilters, now)),
    [events, activeFilters, now],
  );

  const [selection, setSelection] = useState<Selection | null>(null);
  const [flyTarget, setFlyTarget] = useState<FlyTarget | null>(null);
  const selected = selection ? (visible.find((e) => e.id === selection.id) ?? null) : null;

  const updateFilters = useCallback(
    (next: EventFilters) => {
      startTransition(() => {
        setActiveFilters(next);
        const qs = serializeFilters(next).toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
      });
    },
    [pathname, router, setActiveFilters],
  );

  const selectFromMap = useCallback((id: number) => setSelection({ id, origin: "map" }), []);

  const selectFromFeed = useCallback(
    (id: number) => {
      setSelection({ id, origin: "feed" });
      const e = visible.find((v) => v.id === id);
      if (e && e.lat != null && e.lng != null) setFlyTarget({ lat: e.lat, lng: e.lng, nonce: Date.now() });
    },
    [visible],
  );

  const closeDrawer = useCallback(() => setSelection(null), []);
  const isFiltered = filtersKey(activeFilters) !== "";

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      <section aria-label="Event map" className="relative h-[55vh] shrink-0 md:h-auto md:flex-1">
        <MapView events={visible} selected={selected} flyTarget={flyTarget} onSelect={selectFromMap} />
      </section>

      <aside
        aria-label="Live event feed"
        className="relative flex min-h-[60vh] flex-1 flex-col border-t border-border bg-surface md:min-h-0 md:w-[380px] md:flex-none md:border-l md:border-t-0"
      >
        <header className="flex items-center justify-between border-b border-border px-3 py-2">
          <h1 className="font-mono text-xs uppercase tracking-widest text-muted">Live feed</h1>
          <LiveIndicator status={status} count={visible.length} pending={isPending} />
        </header>
        <FilterBar filters={activeFilters} onChange={updateFilters} />
        {error && (
          <p role="alert" className="border-b border-border bg-danger/10 px-3 py-2 text-xs text-danger">
            {error} Live updates will still appear as they arrive.
          </p>
        )}
        <EventList
          events={visible}
          now={now}
          selectedId={selected?.id ?? null}
          scrollToId={selection?.origin === "map" ? selection.id : null}
          freshIds={freshIds}
          onSelect={selectFromFeed}
          filtered={isFiltered}
          onResetFilters={() => updateFilters(DEFAULT_FILTERS)}
        />
        {selected && <EventDrawer event={selected} onClose={closeDrawer} />}
      </aside>
    </div>
  );
}
