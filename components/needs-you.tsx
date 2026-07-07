import Link from "next/link";
import { db } from "@/lib/db";
import { Kicker } from "@/components/ui";

/**
 * The Today queue (P9.4): the 30-seconds-a-day habit is "open app, approve
 * what's waiting, leave" — so what's waiting comes FIRST, before the Hunt
 * cards and the pipeline columns the audit found burying it. One compact
 * list: pending reply drafts (deep-linked) and pending venue pitches
 * (anchored to their card in the feed below). Hidden when nothing needs you.
 */
export async function NeedsYou({ businessId, now }: { businessId: string; now: Date }) {
  const [drafts, pitches] = await Promise.all([
    db.draft.findMany({
      where: { status: "PENDING", lead: { businessId } },
      orderBy: { createdAt: "asc" },
      take: 6,
      select: {
        id: true,
        createdAt: true,
        lead: { select: { id: true, clientName: true } },
      },
    }),
    db.venuePitch.findMany({
      where: { status: "PENDING", businessId },
      orderBy: { createdAt: "asc" },
      take: 6,
      select: {
        id: true,
        createdAt: true,
        followUpOfId: true,
        venue: { select: { id: true, name: true } },
      },
    }),
  ]);

  const total = drafts.length + pitches.length;
  if (total === 0) return null;

  const age = (d: Date) => {
    const h = Math.floor((now.getTime() - d.getTime()) / 3600_000);
    if (h < 1) return "just now";
    if (h < 24) return `${h}h`;
    return `${Math.floor(h / 24)}d`;
  };

  return (
    <section className="mb-6 rounded-3xl bg-cream px-5 py-4 shadow-[0_16px_40px_rgba(0,0,0,0.35)]">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <Kicker>Needs you</Kicker>
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/45">
          {total} waiting · ~30 seconds
        </span>
      </div>
      <ul className="divide-y divide-ink-stage/10">
        {drafts.map((d) => (
          <li key={d.id}>
            <Link
              href={`/dashboard/leads/${d.lead.id}`}
              className="flex min-h-11 items-center justify-between gap-3 py-2 group"
            >
              <span className="min-w-0 truncate text-sm font-semibold text-ink-stage group-hover:text-brand-cyan transition-colors">
                Reply to {d.lead.clientName ?? "a lead"}
              </span>
              <span className="flex flex-none items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-stage/45">
                draft · {age(d.createdAt)}
                <span aria-hidden className="text-brand-cyan">→</span>
              </span>
            </Link>
          </li>
        ))}
        {pitches.map((p) => (
          <li key={p.id}>
            <a
              href={`#venue-${p.venue.id}`}
              className="flex min-h-11 items-center justify-between gap-3 py-2 group"
            >
              <span className="min-w-0 truncate text-sm font-semibold text-ink-stage group-hover:text-brand-cyan transition-colors">
                {p.followUpOfId ? "Follow-up to" : "Pitch"} {p.venue.name}
              </span>
              <span className="flex flex-none items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-stage/45">
                pitch · {age(p.createdAt)}
                <span aria-hidden className="text-brand-cyan">↓</span>
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
