import Link from "next/link";

const LINKS = [
  { href: "/", label: "Map" },
  { href: "/brief", label: "World Brief" },
  { href: "/stats", label: "Stats" },
  { href: "/watchlists", label: "Watchlists" },
];

export function Nav() {
  return (
    <header className="flex h-12 shrink-0 items-center gap-6 border-b border-border bg-surface px-4">
      <Link href="/" className="flex items-center gap-2 font-mono text-sm font-semibold tracking-widest">
        <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />
        PULSE
      </Link>
      <nav className="flex gap-4 text-sm text-muted">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:text-foreground">
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto text-sm">
        <Link href="/login" className="text-muted hover:text-foreground">
          Sign in
        </Link>
      </div>
    </header>
  );
}
