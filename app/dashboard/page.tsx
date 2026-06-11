import Image from "next/image";
import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { OnboardingBanner } from "@/components/onboarding-banner";
import type { LeadStatus } from "@/app/generated/prisma/enums";

export const dynamic = "force-dynamic";

const COLUMNS: { status: LeadStatus; label: string; accent: string }[] = [
  { status: "NEW", label: "New", accent: "bg-brand-cyan" },
  { status: "DRAFTED", label: "Reply ready", accent: "bg-soft-lavender" },
  { status: "REPLIED", label: "Replied", accent: "bg-brand-cyan-soft" },
  { status: "IN_SEQUENCE", label: "Following up", accent: "bg-warm-peach" },
  { status: "ENGAGED", label: "Talking", accent: "bg-soft-lavender" },
  { status: "BOOKED", label: "Booked 🎉", accent: "bg-deep-teal" },
  { status: "DEAD", label: "Gone quiet", accent: "bg-off-white" },
];

function fmtDate(d: Date | null) {
  if (!d) return "date TBD";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function Dashboard() {
  const tenant = await getCurrentBusiness();
  const [leads, spamCount] = await Promise.all([
    db.lead.findMany({
      where: { businessId: tenant.id, status: { not: "SPAM" } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        clientName: true,
        eventType: true,
        eventDate: true,
        venue: true,
        status: true,
      },
    }),
    db.lead.count({ where: { businessId: tenant.id, status: "SPAM" } }),
  ]);
  const business = { ...tenant, leads };

  return (
    <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
      <header className="flex items-center gap-4 mb-8">
        <Image src="/brand/logo.svg" alt="Bright Ears" width={44} height={44} className="bg-deep-teal rounded-xl p-1.5" />
        <div>
          <h1 className="text-2xl font-bold text-deep-teal">{business.name}</h1>
          <p className="text-sm text-ink/60">
            Lead pipeline · {business.leads.length} active · {spamCount} spam filtered out for you
          </p>
        </div>
      </header>

      <OnboardingBanner />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {COLUMNS.map((col) => {
          const leads = business.leads.filter((l) => l.status === col.status);
          return (
            <section key={col.status} className="rounded-2xl bg-white shadow-sm border border-off-white overflow-hidden">
              <h2 className={`${col.accent} px-4 py-2 text-sm font-semibold text-white [&.bg-off-white]:text-ink [&.bg-brand-cyan-soft]:text-deep-teal`}>
                {col.label} <span className="opacity-75">({leads.length})</span>
              </h2>
              <ul className="p-3 space-y-2 min-h-16">
                {leads.map((lead) => (
                  <li key={lead.id}>
                    <Link
                      href={`/dashboard/leads/${lead.id}`}
                      className="block rounded-xl border border-off-white p-3 hover:border-brand-cyan transition-colors"
                    >
                      <p className="font-medium text-sm">{lead.clientName ?? "Unknown"}</p>
                      <p className="text-xs text-ink/60">
                        {lead.eventType ?? "event"} · {fmtDate(lead.eventDate)}
                      </p>
                      {lead.venue && <p className="text-xs text-ink/40">{lead.venue}</p>}
                    </Link>
                  </li>
                ))}
                {leads.length === 0 && <li className="text-xs text-ink/30 px-1">—</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </main>
  );
}
