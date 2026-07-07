import Link from "next/link";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { isoDay } from "@/lib/agent/availability";
import { deleteGig } from "@/app/actions/gigs";
import { GigForm } from "@/components/gig-form";
import { Card, EmptyState, Kicker, PageHeader, StatPill, buttonStyles } from "@/components/ui";

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

/**
 * Gig chip — ink-raised tile: cyan time, cream title (v2 brief). Shared by
 * the sm+ month grid and the phone agenda list (P9.5).
 */
function GigChip({
  gig,
}: {
  gig: {
    id: string;
    title: string;
    venue: string | null;
    startTime: string | null;
    endTime: string | null;
    performer: { name: string } | null;
  };
}) {
  return (
    <div className="rounded-lg bg-ink-raised px-2 py-1.5 shadow-sm">
      <div className="flex items-start justify-between gap-1">
        <div className="min-w-0">
          {gig.startTime && (
            <p className="text-[10px] font-bold text-brand-cyan leading-tight">
              {gig.startTime}
              {gig.endTime ? `–${gig.endTime}` : ""}
            </p>
          )}
          <p className="text-xs font-semibold leading-tight text-cream-bright">{gig.title}</p>
        </div>
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
            className="text-cream/65 hover:text-red-300 leading-none transition-colors"
          >
            ×
          </button>
        </form>
      </div>
      {gig.performer && <p className="text-[10px] text-cream/65">{gig.performer.name}</p>}
      {gig.venue && <p className="text-[10px] text-cream/55">{gig.venue}</p>}
    </div>
  );
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
  // Month-nav pills live INSIDE the white grid card — ink-outline ghost (v2).
  const navButton = `${buttonStyles.secondaryOnLight} text-sm`;

  return (
    <main className="flex-1 bg-ink-stage">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageHeader
        title="Calendar"
        subtitle={`${monthLabel} — the AI checks these dates before it promises anything.`}
        stats={
          gigs.length > 0 ? (
            <StatPill tone="teal">
              {gigs.length} {gigs.length === 1 ? "gig" : "gigs"} this month
            </StatPill>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px] items-start">
        <Card className="p-6">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
            <div>
              <Kicker onLight>The books</Kicker>
              <h2 className="mt-1 text-3xl font-black tracking-tighter text-ink-stage">
                {monthLabel}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/calendar?month=${shiftMonth(year, monthNum, -1)}`}
                aria-label="Previous month"
                className={navButton}
              >
                ←
              </Link>
              <Link href="/dashboard/calendar" className={navButton}>
                Today
              </Link>
              <Link
                href={`/dashboard/calendar?month=${shiftMonth(year, monthNum, 1)}`}
                aria-label="Next month"
                className={navButton}
              >
                →
              </Link>
            </div>
          </div>

          {/* Agenda list (P9.5): seven columns at 375px means ~40px cells —
              gig chips truncate to nothing. Phones get the month as a day
              list (only days with gigs); the grid returns at sm+. */}
          <div className="sm:hidden space-y-3">
            {[...gigsByDay.keys()].sort().map((dayKey) => {
              const dayGigs = gigsByDay.get(dayKey) ?? [];
              const dayNum = Number(dayKey.slice(-2));
              const isToday = dayKey === today;
              const weekday = new Date(Date.UTC(year, monthNum - 1, dayNum)).toLocaleDateString(
                "en-US",
                { weekday: "short", timeZone: "UTC" },
              );
              return (
                <div key={dayKey} className="flex gap-3">
                  <p
                    className={`w-14 flex-none pt-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.12em] ${
                      isToday ? "text-brand-cyan" : "text-ink-stage/45"
                    }`}
                  >
                    {weekday} {dayNum}
                  </p>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {dayGigs.map((gig) => (
                      <GigChip key={gig.id} gig={gig} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="max-sm:hidden grid grid-cols-7 gap-2 mb-2">
            {WEEKDAYS.map((d, i) => (
              <p
                key={d}
                className={`text-center font-mono text-[10px] font-bold uppercase tracking-[0.18em] py-1 ${
                  i === 0 || i === 6 ? "text-ink-stage/60" : "text-ink-stage/35"
                }`}
              >
                {d}
              </p>
            ))}
          </div>

          <div className="max-sm:hidden grid grid-cols-7 gap-2">
            {cells.map((day, i) => {
              const col = i % 7;
              const isWeekend = col === 0 || col === 6;
              if (day === null) {
                return (
                  <div
                    key={`blank-${i}`}
                    className={`min-h-24 rounded-xl ${isWeekend ? "bg-cream/30" : "bg-cream/15"}`}
                  />
                );
              }
              const dayKey = `${month}-${String(day).padStart(2, "0")}`;
              const dayGigs = gigsByDay.get(dayKey) ?? [];
              const isToday = dayKey === today;
              return (
                <div
                  key={dayKey}
                  className={`min-h-24 rounded-xl border p-1.5 space-y-1 ${
                    // Weekend = gig days — warm cream tint on the white grid.
                    isWeekend ? "bg-cream/50" : "bg-white"
                  } ${isToday ? "border-brand-cyan ring-2 ring-brand-cyan/30" : "border-cream"}`}
                >
                  <p className="flex items-center justify-between font-mono text-[11px] font-bold">
                    {isToday ? (
                      // Cyan = interface accent; ink text on cyan (~7.5:1 — white fails).
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand-cyan text-ink-stage">
                        {day}
                      </span>
                    ) : (
                      <span className="text-ink-stage/45">{day}</span>
                    )}
                    {dayGigs.length > 0 && (
                      // Show-voice dot: this date makes noise.
                      <span
                        aria-hidden
                        className="size-1.5 rounded-full bg-gradient-to-r from-neon-magenta to-neon-orange"
                      />
                    )}
                  </p>
                  {dayGigs.map((gig) => (
                    <GigChip key={gig.id} gig={gig} />
                  ))}
                </div>
              );
            })}
          </div>

          {gigs.length === 0 && (
            <div className="mt-3">
              <EmptyState
                compact
                title="Nothing booked this month — yet"
                hint="Add a gig and the AI treats that date as taken."
              />
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="bg-cream/60 px-6 py-4">
            <Kicker onLight>New booking</Kicker>
            <h2 className="mt-1 text-xl font-black tracking-tight text-ink-stage">Add a gig</h2>
            <p className="text-xs text-ink-stage/60 mt-0.5">Booked dates show as conflicts in AI replies.</p>
          </div>
          <div className="p-6">
            <GigForm performers={performers} />
          </div>
        </Card>
      </div>
      </div>
    </main>
  );
}
