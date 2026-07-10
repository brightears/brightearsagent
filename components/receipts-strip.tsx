import { db } from "@/lib/db";

/**
 * "While you were away" receipts (P8.7) — receipts-first beats stats-first
 * for agent products: every visit opens with plain-language proof of work,
 * killing the "what did it even do?" anxiety that makes agent subscriptions
 * churn. Derived entirely from timestamps (last 24h); renders nothing on a
 * quiet day — the strip must never manufacture activity.
 */
export async function ReceiptsStrip({ businessId, now }: { businessId: string; now: Date }) {
  // `now` comes from the page's render clock (the react compiler lint forbids
  // impure calls during render, even in an async server component).
  const since = new Date(now.getTime() - 24 * 3600 * 1000);
  const [venuesFound, pitchesDrafted, pitchesSent, repliesSent, venueReplies] = await Promise.all([
    db.venue.count({ where: { businessId, createdAt: { gte: since } } }),
    db.venuePitch.count({ where: { businessId, createdAt: { gte: since } } }),
    db.venuePitch.count({ where: { businessId, sentAt: { gte: since } } }),
    db.message.count({
      where: { lead: { businessId }, direction: "OUTBOUND", createdAt: { gte: since } },
    }),
    db.venue.count({ where: { businessId, repliedAt: { gte: since } } }),
  ]);

  const parts = [
    venuesFound > 0 ? `found ${venuesFound} venue${venuesFound === 1 ? "" : "s"}` : null,
    pitchesDrafted > 0 ? `drafted ${pitchesDrafted} pitch${pitchesDrafted === 1 ? "" : "es"}` : null,
    pitchesSent > 0 ? `sent ${pitchesSent} pitch${pitchesSent === 1 ? "" : "es"}` : null,
    repliesSent > 0 ? `sent ${repliesSent} repl${repliesSent === 1 ? "y" : "ies"}` : null,
    venueReplies > 0 ? `${venueReplies} venue${venueReplies === 1 ? "" : "s"} wrote back` : null,
  ].filter(Boolean);

  if (parts.length === 0) return null;

  return (
    <div className="mb-6 flex flex-wrap items-baseline gap-x-3 gap-y-1 rounded-2xl border border-cream/10 bg-ink-raised px-4 py-2.5">
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-brand-cyan">
        While you were away
      </span>
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-cream/70">
        {parts.join(" · ")}
      </span>
    </div>
  );
}
