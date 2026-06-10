import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { isoDay } from "@/lib/agent/availability";
import { deleteGig } from "@/app/actions/gigs";
import { GigForm } from "@/components/gig-form";
import { Card } from "@/components/ui";

export const dynamic = "force-dynamic";

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Current "YYYY-MM" / "YYYY-MM-DD" as seen on the business's wall clock. */
function nowInTimezone(timezone: string, withDay: boolean): string {
  // en-CA formats as YYYY-MM-DD — slice off the day for a month key.
  const full = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return withDay ? full : full.slice(0, 7);
}

function shiftMonth(year: number, month: number, delta: number): string {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const business = await getCurrentBusiness();

  const rawMonth = (await searchParams).month;
  const month =
    typeof rawMonth === "string" && MONTH_RE.test(rawMonth)
      ? rawMonth
      : nowInTimezone(business.timezone, false);
  const [year, monthNum] = month.split("-").map(Number);

  // Gig dates are stored as noon UTC of the local calendar date (codebase
  // convention — see lib/agent/availability.ts), so UTC month bounds are safe.
  const monthStart = new Date(Date.UTC(year, monthNum - 1, 1));
  const nextMonthStart = new Date(Date.UTC(year, monthNum, 1));
  const daysInMonth = new Date(Date.UTC(year, monthNum, 0)).getUTCDate();

  const [gigs, performers] = await Promise.all([
    db.gig.findMany({
      where: { businessId: business.id, date: { gte: monthStart, lt: nextMonthStart } },
      include: { performer: { select: { name: true } } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    db.performer.findMany({
      where: { businessId: business.id, active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const gigsByDay = new Map<string, typeof gigs>();
  for (const gig of gigs) {
    const day = isoDay(gig.date);
    const existing = gigsByDay.get(day);
    if (existing) existing.push(gig);
    else gigsByDay.set(day, [gig]);
  }

  // Grid cells: leading blanks to the 1st's weekday, days, trailing blanks to a full week.
  const cells: (number | null)[] = [
    ...Array.from({ length: monthStart.getUTCDay() }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const today = nowInTimezone(business.timezone, true);
  const monthLabel = monthStart.toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const navLink =
    "rounded-xl border border-deep-teal/30 px-3 py-1.5 text-sm font-semibold text-deep-teal hover:border-brand-cyan hover:text-brand-cyan transition-colors";

  return (
    <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-deep-teal">Gig calendar</h1>
        <p className="text-sm text-ink/60">
          Your availability source — the AI checks these dates before it promises anything.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] items-start">
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-deep-teal">{monthLabel}</h2>
            <div className="flex items-center gap-2">
              <Link href={`/dashboard/calendar?month=${shiftMonth(year, monthNum, -1)}`} aria-label="Previous month" className={navLink}>
                ←
              </Link>
              <Link href="/dashboard/calendar" className={navLink}>
                Today
              </Link>
              <Link href={`/dashboard/calendar?month=${shiftMonth(year, monthNum, 1)}`} aria-label="Next month" className={navLink}>
                →
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1.5 mb-1.5">
            {WEEKDAYS.map((d) => (
              <p key={d} className="text-center text-xs font-semibold text-ink/40 py-1">
                {d}
              </p>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`blank-${i}`} className="min-h-24 rounded-xl bg-off-white/30" />;
              }
              const dayKey = `${month}-${String(day).padStart(2, "0")}`;
              const dayGigs = gigsByDay.get(dayKey) ?? [];
              const isToday = dayKey === today;
              return (
                <div
                  key={dayKey}
                  className={`min-h-24 rounded-xl border bg-white p-1.5 space-y-1 ${
                    isToday ? "border-brand-cyan ring-2 ring-brand-cyan/30" : "border-off-white"
                  }`}
                >
                  <p className={`text-xs font-semibold ${isToday ? "text-brand-cyan" : "text-ink/50"}`}>
                    {day}
                  </p>
                  {dayGigs.map((gig) => (
                    <div key={gig.id} className="rounded-lg bg-brand-cyan-soft px-1.5 py-1 text-deep-teal">
                      <div className="flex items-start justify-between gap-1">
                        <p className="text-xs font-semibold leading-tight">{gig.title}</p>
                        <form
                          action={async () => {
                            "use server";
                            await deleteGig(gig.id);
                          }}
                        >
                          <button
                            type="submit"
                            aria-label={`Remove ${gig.title}`}
                            title="Remove gig"
                            className="text-deep-teal/40 hover:text-red-600 leading-none transition-colors"
                          >
                            ×
                          </button>
                        </form>
                      </div>
                      {gig.startTime && (
                        <p className="text-[10px] opacity-75">
                          {gig.startTime}
                          {gig.endTime ? `–${gig.endTime}` : ""}
                        </p>
                      )}
                      {gig.performer && <p className="text-[10px] opacity-75">{gig.performer.name}</p>}
                      {gig.venue && <p className="text-[10px] opacity-60">{gig.venue}</p>}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-lg font-bold text-deep-teal mb-1">Add a gig</h2>
          <p className="text-xs text-ink/60 mb-4">Booked dates show as conflicts in AI replies.</p>
          <GigForm performers={performers} />
        </Card>
      </div>
    </main>
  );
}
