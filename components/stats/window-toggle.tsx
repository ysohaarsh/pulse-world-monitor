import Link from "next/link";
import type { StatsWindow } from "@/lib/stats/aggregate";

const OPTIONS: { value: StatsWindow; label: string }[] = [
  { value: "24h", label: "24 hours" },
  { value: "7d", label: "7 days" },
];

export function WindowToggle({ current }: { current: StatsWindow }) {
  return (
    <nav aria-label="Time window" className="inline-flex rounded-md border border-border bg-surface p-0.5 text-sm">
      {OPTIONS.map((o) => {
        const active = o.value === current;
        return (
          <Link
            key={o.value}
            href={`/stats?window=${o.value}`}
            aria-current={active ? "page" : undefined}
            className={`rounded px-3 py-1 transition-colors ${
              active ? "bg-surface-2 text-accent" : "text-muted hover:text-foreground"
            }`}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}
