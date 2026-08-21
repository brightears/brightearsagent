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
import { getTranslations } from "@/lib/i18n/server";
import { languageTag } from "@/lib/i18n/config";

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
  const { locale, t } = await getTranslations();
  const business = await getCurrentBusiness();
  const results = await computeResults(business.id);
  const monthLabel = results.monthStart.toLocaleDateString(languageTag(locale), {
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="flex-1 bg-ink-stage">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <PageHeader
          title={t("dashboard.results.title")}
          accent={t("dashboard.results.title")}
          subtitle={t("dashboard.results.subtitle")}
        />

        {!hasResults(results) ? (
          <div className="rounded-3xl border border-cream/10 bg-ink-raised px-6 py-16 text-center">
            <p className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-cream/55">
              {t("dashboard.results.emptyTitle")}
            </p>
            <p className="mx-auto mt-4 max-w-md text-lg leading-relaxed text-cream/70">
              {t("dashboard.results.emptyHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-12">
            <Section title={t("dashboard.results.huntSince", { date: monthLabel })}>
              <Stat value={results.venuesFound} label={t("dashboard.results.venuesFound")} />
              <Stat value={results.pitchesSent} label={t("dashboard.results.pitchesSentVoice")} />
              <Stat value={results.conversationsActive} label={t("dashboard.results.conversations")} />
              <Stat value={results.gigsBookedThisMonth} label={t("dashboard.results.gigsMonth")} show />
              {results.bookedValueThisMonth > 0 && (
                <Stat
                  value={formatMinor(results.bookedValueThisMonth, business.currency)}
                  label={t("dashboard.results.valueMonth")}
                  show
                />
              )}
            </Section>

            <Section title={t("dashboard.results.inboxSince", { date: monthLabel })}>
              <Stat value={results.repliesSent} label={t("dashboard.results.inquiriesAnswered")} />
              <Stat
                value={locale === "th" && results.medianFirstReplyMinutes !== null
                  ? `${results.medianFirstReplyMinutes} นาที`
                  : formatReplyTime(results.medianFirstReplyMinutes)}
                label={t("dashboard.results.medianReply")}
              />
              <Stat value={results.spamFiltered} label={t("dashboard.results.spam")} />
              <Stat value={results.newInquiries} label={t("dashboard.results.realInquiries")} />
            </Section>

            <Section title={t("dashboard.results.allTime")}>
              <Stat value={results.gigsBookedAllTime} label={t("dashboard.results.gigsBooked")} show />
              {results.bookedValueAllTime > 0 && (
                <Stat
                  value={formatMinor(results.bookedValueAllTime, business.currency)}
                  label={t("dashboard.results.valueRecorded")}
                  show
                />
              )}
              <Stat value={results.venuesFoundAllTime} label={t("dashboard.results.venuesFound")} />
              <Stat value={results.pitchesSentAllTime} label={t("dashboard.results.pitchesSent")} />
            </Section>

            <p className="max-w-2xl text-xs leading-relaxed text-cream/45">
              {t("dashboard.results.disclaimer")}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
