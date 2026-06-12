// "The Hunt" — the proactive half of the one home feed (ADR-004, ROADMAP
// 10.4): venue opportunities the sales agent found, rendered ABOVE the
// pipeline columns on the dashboard. Server component — card actions are
// plain forms bound to the tenant-scoped server actions in
// app/actions/venues.ts (the license is re-checked there; the UI gate here is
// just honest signage).
import Link from "next/link";
import { Card, EmptyState, Kicker, StatPill, buttonStyles } from "@/components/ui";
import { skipVenueForm } from "@/app/actions/venues";
import { DraftPitchButton, VenuePitchReview, type HuntPitch } from "@/components/venue-pitch-review";
import { jurisdictionFor, pitchFooter } from "@/lib/outreach/jurisdiction";
import { SKIP_REASONS, fitScoreTone, signalAgeLabel, type SkipReason } from "@/lib/venues/feed";
import type { VenueKind, VenueStatus } from "@/app/generated/prisma/enums";

/** The slice of a Venue row the feed card renders. */
export type HuntVenue = {
  id: string;
  name: string;
  city: string;
  country: string;
  kind: VenueKind;
  status: VenueStatus;
  fitScore: number | null;
  fitReasons: string[];
  caution: string | null;
  lastSignalAt: Date | null;
  bookingEmail: string | null;
  contactSource: string | null;
  /** The live pitch (PENDING or parked APPROVED), when one exists (10.3). */
  pitch: HuntPitch | null;
};

// Fit-score chip per temperature — interface voice only (cyan/cream), the
// score is data, never the show gradient (DESIGN.md).
const FIT_CHIP: Record<ReturnType<typeof fitScoreTone>, string> = {
  hot: "bg-brand-cyan text-ink-stage",
  warm: "bg-cream text-ink-stage",
  cool: "bg-cream/40 text-ink-stage/70",
};

const KIND_LABEL: Record<VenueKind, string> = {
  BAR: "Bar",
  ROOFTOP: "Rooftop",
  HOTEL: "Hotel",
  RESTAURANT: "Restaurant",
  EVENT_SPACE: "Event space",
  CLUB: "Club",
  OTHER: "Venue",
};

function VenueCard({
  venue,
  canPitch,
  profilePercent,
  businessName,
  homeCity,
  now,
}: {
  venue: HuntVenue;
  canPitch: boolean;
  profilePercent: number;
  businessName: string;
  homeCity: string;
  now: Date;
}) {
  const score = venue.fitScore ?? 0;
  // Jurisdiction is recipient-side (the venue's country, ADR-004 D4). The mode
  // snapshot on the pitch wins (drafted under those rules); the live map covers
  // the note + footer for fresh renders.
  const jurisdiction = jurisdictionFor(venue.country);
  return (
    // White data card on the ink stage — never tilted (app rule).
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold leading-tight text-ink-stage">{venue.name}</p>
          <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-stage/50">
            {KIND_LABEL[venue.kind]}
          </p>
          <p className="mt-0.5 text-xs text-ink-stage/60">
            {venue.city}, {venue.country}
          </p>
        </div>
        <span
          className={`flex-none rounded-full px-2.5 py-1 font-mono text-sm font-bold ${FIT_CHIP[fitScoreTone(score)]}`}
          title={`Fit score ${score} of 100`}
        >
          {score}
        </span>
      </div>

      {venue.fitReasons.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {venue.fitReasons.slice(0, 3).map((reason) => (
            <li key={reason} className="flex items-start gap-2 text-xs text-ink-stage/75">
              <span aria-hidden className="mt-1.5 size-1 flex-none bg-brand-cyan" />
              {reason}
            </li>
          ))}
        </ul>
      )}
      {venue.caution && (
        <p className="mt-2 flex items-start gap-2 text-xs text-ink-stage/75">
          <span aria-hidden className="mt-1.5 size-1 flex-none bg-neon-orange" />
          {venue.caution}
        </p>
      )}

      <div className="mt-3 space-y-0.5">
        {venue.lastSignalAt && (
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/45">
            Signal: {signalAgeLabel(venue.lastSignalAt, now)}
          </p>
        )}
        {venue.bookingEmail && (
          // Provenance builds trust — where the agent found the contact.
          <p className="text-[11px] text-ink-stage/45">
            Contact: {venue.contactSource ?? "published booking contact"}
          </p>
        )}
      </div>

      {/* The review surface (10.3): a drafted pitch auto-opens on the card —
          subject, body, jurisdiction note, Approve/Edit/Discard. */}
      {venue.status === "PITCH_DRAFTED" && venue.pitch && (
        <VenuePitchReview
          pitch={venue.pitch}
          jurisdictionNote={jurisdiction.note}
          footer={pitchFooter({
            mode: jurisdiction.mode,
            businessName,
            city: homeCity,
            venueName: venue.name,
          })}
        />
      )}

      {venue.status !== "PITCH_DRAFTED" && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-stage/10 pt-3">
          {canPitch ? (
            <DraftPitchButton venueId={venue.id} />
          ) : (
            <button
              type="button"
              disabled
              aria-disabled
              className={`${buttonStyles.primary} px-3.5 py-1.5 text-sm`}
              title="Finish your profile to unlock pitching"
            >
              Pitch locked
            </button>
          )}

          {/* One-tap skip reason picker — native <details> popover, no JS. */}
          <details className="relative">
            <summary
              className={`${buttonStyles.secondaryOnLight} inline-block cursor-pointer list-none px-3.5 py-1.5 text-sm [&::-webkit-details-marker]:hidden`}
            >
              Skip
            </summary>
            <div className="absolute left-0 top-full z-10 mt-2 w-44 rounded-2xl border border-ink-stage/10 bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
              <p className="px-2 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-stage/45">
                Why skip?
              </p>
              {(Object.keys(SKIP_REASONS) as SkipReason[]).map((reason) => (
                <form key={reason} action={skipVenueForm.bind(null, venue.id, reason)}>
                  <button
                    type="submit"
                    className="w-full rounded-xl px-2 py-1.5 text-left text-sm font-semibold text-ink-stage/80 transition-colors hover:bg-cream"
                  >
                    {SKIP_REASONS[reason]}
                  </button>
                </form>
              ))}
            </div>
          </details>
        </div>
      )}

      {!canPitch && venue.status !== "PITCH_DRAFTED" && (
        <p className="mt-2 text-[11px] text-ink-stage/55">
          <Link href="/dashboard/profile" className="font-semibold text-brand-cyan hover:opacity-80">
            Finish your profile
          </Link>{" "}
          to unlock pitching — {profilePercent}%
        </p>
      )}
    </Card>
  );
}

/** How many cards show before "view all" (?hunt=all) expands the rail. */
export const HUNT_CAP = 8;

export function HuntSection({
  venues,
  totalCount,
  expanded,
  canPitch,
  profilePercent,
  businessName,
  homeCity,
}: {
  /** Already capped (or full when expanded), fitScore desc. */
  venues: HuntVenue[];
  totalCount: number;
  expanded: boolean;
  canPitch: boolean;
  profilePercent: number;
  /** Footer identity (jurisdiction compliance close): real business name… */
  businessName: string;
  /** …plus home-base city (first service city; empty string when unset). */
  homeCity: string;
}) {
  const now = new Date();
  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Kicker>The hunt</Kicker>
          <h2 className="mt-1.5 text-xl font-black tracking-tight text-cream-bright">
            Venues your agent found
          </h2>
        </div>
        {totalCount > 0 && <StatPill tone="teal">{totalCount} found</StatPill>}
      </div>

      {totalCount === 0 ? (
        // Typography-first empty state (v2.1 LAW rule 7) — no icons, ever.
        <EmptyState
          kicker="The hunt"
          title="Your agent hasn't hunted yet."
          accent="yet."
          hint="Once the venue scanner connects, new openings and rooms that fit your sound land here — scored, with the reasons spelled out."
          cta={
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-stage/45">
              Scanner arrives with the next update
            </span>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-1 items-start gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {venues.map((venue) => (
              <VenueCard
                key={venue.id}
                venue={venue}
                canPitch={canPitch}
                profilePercent={profilePercent}
                businessName={businessName}
                homeCity={homeCity}
                now={now}
              />
            ))}
          </div>
          {!expanded && totalCount > venues.length && (
            <p className="mt-4">
              <Link
                href="/dashboard?hunt=all"
                className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-brand-cyan hover:opacity-80"
              >
                View all {totalCount} venues
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
