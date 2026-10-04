// TODO(ui-map, ui-feed): map fills the main area, live feed sits in a right-hand panel.
export default function Home() {
  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex flex-1 items-center justify-center text-muted">Map</section>
      <aside className="w-96 border-l border-border bg-surface p-4 text-muted">Live feed</aside>
    </div>
  );
}
