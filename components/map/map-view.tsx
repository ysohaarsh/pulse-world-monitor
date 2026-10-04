"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { hasCoords } from "@/lib/events/row";
import type { EventRow } from "@/lib/types";
import type { FlyTarget, GeoEvent } from "./event-map";
import { MapLegend } from "./legend";

// Leaflet touches `window` at import time, so it must never be server-rendered.
const EventMap = dynamic(() => import("./event-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-background font-mono text-xs text-muted">
      Loading map…
    </div>
  ),
});

export interface MapViewProps {
  events: EventRow[];
  selected: EventRow | null;
  flyTarget: FlyTarget | null;
  onSelect: (id: number) => void;
}

export function MapView({ events, selected, flyTarget, onSelect }: MapViewProps) {
  const geo = useMemo(() => events.filter(hasCoords) as GeoEvent[], [events]);
  const selectedGeo = selected && hasCoords(selected) ? (selected as GeoEvent) : null;
  const unlocated = events.length - geo.length;

  return (
    <div className="relative isolate h-full w-full">
      <EventMap events={geo} selected={selectedGeo} flyTarget={flyTarget} onSelect={onSelect} />
      <div className="pointer-events-none absolute bottom-6 left-2 z-[1000] flex flex-col items-start gap-2">
        {unlocated > 0 && (
          <p className="rounded border border-border bg-surface/90 px-2 py-1 text-[11px] text-muted">
            {unlocated} event{unlocated === 1 ? "" : "s"} without a location (feed only)
          </p>
        )}
        <MapLegend />
      </div>
    </div>
  );
}
