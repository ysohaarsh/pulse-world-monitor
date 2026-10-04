import Link from "next/link";
import { signOut } from "@/app/auth/actions";
import { AlertsBadge } from "@/components/auth/alerts-badge";
import { getCurrentUser } from "@/components/auth/session";
import { FOCUS } from "@/components/auth/styles";
import { createClient } from "@/lib/supabase/server";

const LINKS = [
  { href: "/", label: "Map" },
  { href: "/brief", label: "World Brief" },
  { href: "/stats", label: "Stats" },
  { href: "/watchlists", label: "Watchlists" },
];

async function unreadAlertCount(userId: string): Promise<number> {
  try {
    const supabase = await createClient();
    const { count } = await supabase
      .from("alerts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("read_at", null);
    return count ?? 0;
  } catch {
    return 0;
  }
}

export async function Nav() {
  const user = await getCurrentUser();
  const unread = user ? await unreadAlertCount(user.id) : 0;

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 whitespace-nowrap border-b border-border bg-surface px-4 sm:gap-6">
      <Link href="/" className="flex shrink-0 items-center gap-2 font-mono text-sm font-semibold tracking-widest">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        PULSE
      </Link>
      <nav aria-label="Main" className="flex min-w-0 gap-3 overflow-x-auto text-sm text-muted sm:gap-4">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-foreground">
            {l.label}
          </Link>
        ))}
        {user && (
          <Link href="/alerts" className="inline-flex items-center hover:text-foreground">
            Alerts
            <AlertsBadge userId={user.id} initialCount={unread} />
          </Link>
        )}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-3 text-sm">
        {user ? (
          <>
            <span className="hidden max-w-48 truncate text-muted sm:inline" title={user.email ?? undefined}>
              {user.email ?? "Signed in"}
            </span>
            <form action={signOut}>
              <button type="submit" className={`rounded text-muted hover:text-foreground ${FOCUS}`}>
                Sign out
              </button>
            </form>
          </>
        ) : (
          <Link href="/login" className="text-muted hover:text-foreground">
            Sign in
          </Link>
        )}
      </div>
    </header>
  );
}
