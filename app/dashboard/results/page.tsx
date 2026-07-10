// The "Results" proof surface — the live, in-app dashboard view of what the
// agent actually did (the email weekly report's richer in-app sibling). Two
// halves, honest numbers only: the proactive HUNT and the reactive INBOX, plus
// the all-time trophy row. Design LAW (docs/DESIGN.md): ink canvas, white/cream
// cards, cyan = interface, magenta→orange reserved for the show/celebration
// (the booked count), mono kickers, NO emoji.
import { getCurrentBusiness } from "@/lib/tenant";
import { computeResults, hasResults, formatReplyTime } from "@/lib/reports/results";
import { formatMinor } from "@/lib/quote/fee";
import { PageHeader, Kicker } from "@/components/ui";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";

/** A metric tile floating on the ink. `show` paints the number with the
 *  magenta→orange celebration gradient (reserved for the booked count). */
function Stat({
  value,
  label,
  show = false,
}: {
  value: ReactNode;
  label: string;
  show?: boolean;
}) {
  return (
    <div className="rounded-3xl border border-cream/10 bg-ink-raised p-6">
      <div
        className={`text-4xl font-black tracking-tight ${
          show
            ? "bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent"
            : "text-cream-bright"
        }`}
      >
        {value}
      </div>
      <div className="mt-2 max-w-[220px] text-sm leading-snug text-cream/55">{label}</div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-4">
        <Kicker>{title}</Kicker>
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export default async function ResultsPage() {
  const business = await getCurrentBusiness();
  const results = await computeResults(business.id);
  const monthLabel = results.monthStart.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="flex-1 bg-ink-stage">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <PageHeader
          title="Results"
          accent="Results"
          subtitle="What your agent actually did — the Hunt and the inbox, in numbers. Nothing inflated, nothing invented."
        />

        {!hasResults(results) ? (
          <div className="rounded-3xl border border-cream/10 bg-ink-raised px-6 py-16 text-center">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-cream/55">
              Nothing to show yet
            </p>
            <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-cream/70">
              The moment your agent starts hunting venues and answering inquiries, the proof lands
              here — found, pitched, answered, booked.
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            <Section title={`The Hunt · since ${monthLabel}`}>
              <Stat value={results.venuesFound} label="venues found for you" />
              <Stat value={results.pitchesSent} label="pitches sent in your voice" />
              <Stat value={results.conversationsActive} label="conversations in progress" />
              <Stat value={results.gigsBookedThisMonth} label="gigs booked this month" show />
              {results.bookedValueThisMonth > 0 && (
                <Stat
                  value={formatMinor(results.bookedValueThisMonth, business.currency)}
                  label="booked value this month"
                  show
                />
              )}
            </Section>

            <Section title={`Your inbox · since ${monthLabel}`}>
              <Stat value={results.repliesSent} label="inquiries answered in your voice" />
              <Stat
                value={formatReplyTime(results.medianFirstReplyMinutes)}
                label="median first reply — the speed clients reward"
              />
              <Stat value={results.spamFiltered} label="spam & scams filtered before you saw them" />
              <Stat value={results.newInquiries} label="real inquiries this month" />
            </Section>

            <Section title="All time">
              <Stat value={results.gigsBookedAllTime} label="gigs booked" show />
              {results.bookedValueAllTime > 0 && (
                <Stat
                  value={formatMinor(results.bookedValueAllTime, business.currency)}
                  label="booked value recorded"
                  show
                />
              )}
              <Stat value={results.venuesFoundAllTime} label="venues found for you" />
              <Stat value={results.pitchesSentAllTime} label="pitches sent" />
            </Section>

            <p className="max-w-2xl text-xs leading-relaxed text-cream/45">
              Every number here is something the agent did — venues surfaced, pitches sent in your
              voice, inquiries answered, gigs you booked. Whether a room says yes is still down to
              you and them; we only make sure you never miss the shot.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
