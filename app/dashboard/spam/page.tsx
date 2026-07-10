import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { Card, EmptyState, Kicker, PageHeader, StatPill } from "@/components/ui";
import { SpamRescueButton } from "@/components/spam-rescue-button";

export const dynamic = "force-dynamic";

// Spam folder (P10.6): the filter earns trust by being INSPECTABLE — the
// dashboard pill says "12 spam filtered for you"; this is where the owner can
// check the net and rescue anything real. Each row shows WHY it was filtered
// (spamReason) and offers the one-tap overrule.
export default async function SpamPage() {
  const business = await getCurrentBusiness();
  const spam = await db.lead.findMany({
    where: { businessId: business.id, status: "SPAM" },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      clientName: true,
      clientEmail: true,
      rawSubject: true,
      rawBody: true,
      spamReason: true,
      createdAt: true,
    },
  });

  const fmt = (d: Date) =>
    d.toLocaleDateString("en-US", {
      timeZone: business.timezone,
      month: "short",
      day: "numeric",
    });

  return (
    <main className="flex-1 bg-ink-stage">
      <div className="mx-auto w-full max-w-4xl px-6 py-8">
        <PageHeader
          title="Spam"
          subtitle="Everything the filter caught, and why — rescue anything real with one tap."
          stats={spam.length > 0 ? <StatPill>{spam.length} filtered</StatPill> : undefined}
        />

        <div className="mb-4">
          <Link
            href="/dashboard"
            className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-cream/55 transition-colors hover:text-brand-cyan"
          >
            ← Back to pipeline
          </Link>
        </div>

        <Card className="p-6">
          <Kicker onLight>The net</Kicker>
          {spam.length === 0 ? (
            <div className="mt-3">
              <EmptyState
                compact
                title="Nothing in the net"
                hint="When the filter catches something, it lands here with the reason — nothing is deleted silently."
              />
            </div>
          ) : (
            <ul className="mt-2 divide-y divide-ink-stage/10">
              {spam.map((lead) => (
                <li key={lead.id} className="flex items-start justify-between gap-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-stage">
                      {lead.clientName ?? lead.clientEmail ?? "Unknown sender"}
                      <span className="ml-2 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-ink-stage/40">
                        {fmt(lead.createdAt)}
                      </span>
                    </p>
                    <p className="mt-0.5 line-clamp-2 text-sm text-ink-stage/60">
                      {lead.rawSubject || lead.rawBody.slice(0, 160)}
                    </p>
                    {lead.spamReason && (
                      <p className="mt-1 font-mono text-[11px] font-bold uppercase tracking-[0.12em] text-ink-stage/45">
                        Filtered: {lead.spamReason}
                      </p>
                    )}
                  </div>
                  <SpamRescueButton leadId={lead.id} />
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </main>
  );
}
