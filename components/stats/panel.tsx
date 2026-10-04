import type { ReactNode } from "react";

export function Panel({
  title,
  subtitle,
  className = "",
  children,
}: {
  title: string;
  subtitle?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={`flex min-w-0 flex-col rounded-lg border border-border bg-surface p-4 ${className}`}>
      <header className="mb-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

export function EmptyChart({ message = "No events in this window yet." }: { message?: string }) {
  return (
    <div className="flex min-h-40 flex-1 items-center justify-center rounded-md border border-dashed border-border px-4 text-center text-sm text-muted">
      {message}
    </div>
  );
}
