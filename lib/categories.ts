import type { Category } from "@/lib/types";

/** Display metadata shared by the map, feed and stats so colors stay consistent. */
export const CATEGORY_META: Record<Category, { label: string; color: string }> = {
  earthquake: { label: "Earthquake", color: "#f97316" },
  wildfire: { label: "Wildfire", color: "#ef4444" },
  storm: { label: "Storm", color: "#8b5cf6" },
  volcano: { label: "Volcano", color: "#dc2626" },
  flood: { label: "Flood", color: "#3b82f6" },
  conflict: { label: "Conflict", color: "#f43f5e" },
  politics: { label: "Politics", color: "#eab308" },
  economy: { label: "Economy", color: "#10b981" },
  health: { label: "Health", color: "#14b8a6" },
  other: { label: "Other", color: "#94a3b8" },
};
