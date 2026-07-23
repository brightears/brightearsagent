// Instant skeleton for the dashboard (audit 2026-07): the page runs a
// 10-query Promise.all, so tab taps felt dead on mobile — nothing painted
// until every query returned. This mirrors the real layout's footprint
// (header + stat pills, a Hunt-feed hero card, the pipeline column grid) so
// the swap to live content doesn't jump. Ink-canvas tokens only; the pulse is
// guarded for reduced-motion (docs/DESIGN.md safety rule).

/** One ghost line — width set per call site to sketch the real text shape. */
function Bar({ className }: { className: string }) {
  return <div className={`rounded-full bg-cream/10 ${className}`} />;
}

export default function DashboardLoading() {
  return (
    <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
      <span className="sr-only">Loading your pipeline</span>
      <div aria-hidden className="animate-pulse motion-reduce:animate-none">
        {/* Header: kicker, big title, subtitle — then the stat-pill row. */}
        <div className="pt-2">
          <Bar className="h-3 w-24" />
          <Bar className="mt-4 h-9 w-64" />
          <Bar className="mt-3 h-4 w-40" />
          <div className="mt-5 flex flex-wrap gap-2.5">
            <div className="h-7 w-28 rounded-full bg-cream/10" />
            <div className="h-7 w-40 rounded-full bg-cream/10" />
            <div className="h-7 w-36 rounded-full bg-cream/10" />
          </div>
        </div>

        {/* The Hunt hero: section heading + two feed-card ghosts. */}
        <div className="mt-10">
          <Bar className="h-3 w-20" />
          <Bar className="mt-3 h-6 w-52" />
          <div className="mt-4 space-y-4">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="rounded-3xl border border-cream/10 bg-ink-raised px-6 py-5"
              >
                <div className="flex items-center justify-between gap-4">
                  <Bar className="h-5 w-48" />
                  <div className="h-6 w-16 rounded-full bg-cream/10" />
                </div>
                <Bar className="mt-3 h-3.5 w-3/4" />
                <Bar className="mt-2 h-3.5 w-1/2" />
              </div>
            ))}
          </div>
        </div>

        {/* Pipeline columns: same responsive grid as the real board. */}
        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className="overflow-hidden rounded-3xl border border-cream/10 bg-ink-raised"
            >
              <div className="border-b border-cream/10 px-4 py-3">
                <Bar className="h-4 w-24" />
              </div>
              <div className="space-y-2.5 p-3">
                <div className="h-16 rounded-2xl bg-cream/5" />
                <div className="h-16 rounded-2xl bg-cream/5" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
