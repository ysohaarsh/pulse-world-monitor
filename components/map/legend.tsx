import { CATEGORY_META } from "@/lib/categories";
import { CATEGORIES } from "@/lib/types";

export function MapLegend({ className = "" }: { className?: string }) {
  return (
    <section
      aria-label="Map legend"
      className={`pointer-events-auto rounded-md border border-border bg-surface/90 px-3 py-2 text-xs backdrop-blur ${className}`}
    >
      <h2 className="mb-1 font-mono text-[10px] uppercase tracking-widest text-muted">Categories</h2>
      <ul className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {CATEGORIES.map((c) => (
          <li key={c} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: CATEGORY_META[c].color }}
            />
            {CATEGORY_META[c].label}
          </li>
        ))}
      </ul>
      <p className="mt-1 text-[10px] text-muted">Marker size = severity</p>
    </section>
  );
}
