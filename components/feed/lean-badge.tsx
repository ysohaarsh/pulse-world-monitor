import { LEAN_META, leanDescription, MEDIA_LEANS, outletForUrl } from "@/lib/media-lean";

export const ALLSIDES_RATINGS_URL = "https://www.allsides.com/media-bias/ratings";

/**
 * Compact outlet-lean marker: a 5-cell left→right bar with the outlet's cell lit, plus a short
 * code (L / LL / C / LR / R). Deliberately neutral (HUD greens, not party red/blue). Renders
 * nothing when the article's outlet isn't AllSides-rated.
 */
export function LeanBadge({ url, className = "" }: { url: string | null; className?: string }) {
  const outlet = outletForUrl(url);
  if (!outlet) return null;
  const meta = LEAN_META[outlet.lean];
  const description = leanDescription(outlet);
  return (
    <span
      role="img"
      aria-label={`Outlet lean: ${description}`}
      title={description}
      data-lean={outlet.lean}
      className={`inline-flex items-center gap-1 normal-case tracking-normal ${className}`}
    >
      <span aria-hidden className="flex items-center gap-px">
        {MEDIA_LEANS.map((l, i) => (
          <span
            key={l}
            className={
              i === meta.position
                ? "h-2 w-1 bg-accent shadow-[0_0_4px_var(--accent)]"
                : i === 2
                  ? "h-1.5 w-1 bg-border-strong"
                  : "h-1.5 w-1 bg-border"
            }
          />
        ))}
      </span>
      <span aria-hidden className="font-mono text-[9px] leading-none text-muted">
        {meta.code}
      </span>
    </span>
  );
}
