import { CATEGORY_META } from "@/lib/categories";
import { countryName, formatUtc, SOURCE_LABELS } from "@/lib/stats/format";
import type { Category } from "@/lib/types";
import type { TopEvent } from "@/app/brief/queries";
import { safeHttpUrl } from "@/lib/url";
import { LeanBadge } from "@/components/feed/lean-badge";

export function TopEvents({
  events,
  emptyText = "No events recorded in this period yet.",
  showSeverity = true,
}: {
  events: TopEvent[];
  emptyText?: string;
  /** Sports items are all severity 1, so the Sports panel hides the badge. */
  showSeverity?: boolean;
}) {
  if (events.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
        {emptyText}
      </p>
    );
  }
  return (
    <ol className="flex flex-col divide-y divide-border">
      {events.map((e) => {
        const meta = CATEGORY_META[e.category as Category] ?? CATEGORY_META.other;
        const href = safeHttpUrl(e.url);
        return (
          <li key={e.id} className="flex items-start gap-3 py-3">
            <span aria-hidden className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.color }} />
            <div className="min-w-0 flex-1">
              {href ? (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:text-accent hover:underline"
                >
                  {e.title}
                  <span className="sr-only"> (opens in a new tab)</span>
                  <span aria-hidden className="ml-1 text-muted">
                    ↗
                  </span>
                </a>
              ) : (
                <span className="font-medium">{e.title}</span>
              )}
              <p className="mt-0.5 text-xs text-muted">
                <span style={{ color: meta.color }}>{meta.label}</span>
                {" · "}
                <time dateTime={e.occurred_at}>{formatUtc(e.occurred_at)}</time>
                {e.country && <> · {countryName(e.country)}</>}
                {" · "}
                {SOURCE_LABELS[e.source] ?? e.source}
                <LeanBadge url={e.url} className="ml-2 align-middle" />
              </p>
            </div>
            {showSeverity && (
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-xs tabular-nums ${
                  e.severity >= 4 ? "border-danger/50 text-danger" : "border-border text-muted"
                }`}
              >
                <span className="sr-only">Severity </span>S{e.severity}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
