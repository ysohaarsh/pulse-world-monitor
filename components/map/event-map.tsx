"use client";

import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import "./map.css";

import { memo, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { CircleMarker, MapContainer, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { CATEGORY_META } from "@/lib/categories";
import type { EventRow } from "@/lib/types";

export type GeoEvent = EventRow & { lat: number; lng: number };

/** A request to fly the map to an event; `nonce` lets the same event be re-targeted. */
export interface FlyTarget {
  lat: number;
  lng: number;
  nonce: number;
}

export interface EventMapProps {
  events: GeoEvent[];
  selected: GeoEvent | null;
  flyTarget: FlyTarget | null;
  onSelect: (id: number) => void;
}

// Esri dark gray canvas: free, keyless (CARTO basemaps now require an API key).
const ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas";
const TILE_URL = `${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
const LABELS_URL = `${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}`;
const ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';

export function severityRadius(severity: number): number {
  return 4 + severity * 2;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Minimal shape of Leaflet.markercluster's cluster object (its @types package isn't installed). */
interface ClusterLike {
  getAllChildMarkers(): L.Layer[];
  getChildCount(): number;
}

/** Cluster bubble colored by the most common category inside it. */
function clusterIcon(cluster: ClusterLike): L.DivIcon {
  const children = cluster.getAllChildMarkers() as unknown as L.CircleMarker[];
  const counts = new Map<string, number>();
  for (const m of children) {
    const color = m.options.fillColor ?? CATEGORY_META.other.color;
    counts.set(color, (counts.get(color) ?? 0) + 1);
  }
  let color = CATEGORY_META.other.color;
  let best = 0;
  for (const [c, n] of counts) if (n > best) [color, best] = [c, n];
  const count = cluster.getChildCount();
  const size = count < 10 ? 30 : count < 100 ? 36 : 44;
  return L.divIcon({
    html: `<span style="--c:${escapeHtml(color)}">${count}</span>`,
    className: "pulse-cluster",
    iconSize: L.point(size, size),
  });
}

function FlyTo({ target }: { target: FlyTarget | null }) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 7), { duration: 0.8 });
  }, [map, target]);
  return null;
}

function formatCoord(value: number, pos: string, neg: string): string {
  return `${Math.abs(value).toFixed(2).padStart(6, "0")}°${value >= 0 ? pos : neg}`;
}

/** HUD readout of the cursor position and zoom, top-right of the map. */
function CursorReadout() {
  const map = useMap();
  const [pos, setPos] = useState<L.LatLng | null>(null);
  const [zoom, setZoom] = useState(() => map.getZoom());
  useMapEvents({
    mousemove: (e) => setPos(e.latlng.wrap()),
    mouseout: () => setPos(null),
    zoomend: () => setZoom(map.getZoom()),
  });
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute right-2 top-2 z-[1000] hidden border border-border-strong bg-background/80 px-2 py-1 font-mono text-[10px] tracking-wider text-accent sm:block"
    >
      {pos ? `LAT ${formatCoord(pos.lat, "N", "S")}  LON ${formatCoord(pos.lng, "E", "W")}` : "LAT ---.--°  LON ---.--°"}
      <span className="ml-3 text-muted">Z{String(zoom).padStart(2, "0")}</span>
    </div>
  );
}

const Markers = memo(function Markers({
  events,
  onSelect,
}: {
  events: GeoEvent[];
  onSelect: (id: number) => void;
}) {
  return (
    <MarkerClusterGroup
      chunkedLoading
      showCoverageOnHover={false}
      maxClusterRadius={45}
      spiderfyOnMaxZoom
      iconCreateFunction={clusterIcon}
    >
      {events.map((e) => {
        const color = CATEGORY_META[e.category].color;
        return (
          <CircleMarker
            key={e.id}
            center={[e.lat, e.lng]}
            radius={severityRadius(e.severity)}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 0.45,
              weight: 1.5,
              opacity: 1,
              className: e.severity >= 4 ? "pulse-hot" : undefined,
            }}
            eventHandlers={{ click: () => onSelect(e.id) }}
          >
            <Tooltip direction="top" offset={[0, -4]}>
              {e.title}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MarkerClusterGroup>
  );
});

export default function EventMap({ events, selected, flyTarget, onSelect }: EventMapProps) {
  const selectedColor = selected ? CATEGORY_META[selected.category].color : undefined;
  const selectedOptions = useMemo(
    () => ({ color: "#00ff88", weight: 2.5, fillColor: selectedColor, fillOpacity: 0.9, className: "pulse-selected" }),
    [selectedColor],
  );

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      minZoom={2}
      worldCopyJump
      className="pulse-map h-full w-full"
      aria-label="Map of recent world events"
    >
      <TileLayer url={TILE_URL} attribution={ATTRIBUTION} maxZoom={16} />
      <TileLayer url={LABELS_URL} maxZoom={16} />
      <Markers events={events} onSelect={onSelect} />
      {selected && (
        // Rendered outside the cluster so the selection is always visible on top.
        <CircleMarker
          key={`selected-${selected.id}`}
          center={[selected.lat, selected.lng]}
          radius={severityRadius(selected.severity) + 3}
          pathOptions={selectedOptions}
          interactive={false}
        />
      )}
      <FlyTo target={flyTarget} />
      <CursorReadout />
    </MapContainer>
  );
}
