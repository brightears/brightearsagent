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
import { contactConfidence } from "@/lib/venues/contact-confidence";
import { VenueNotes } from "@/components/venue-notes";
import {
  SKIP_REASONS,
  TEMPERATURE_CHIP,
  fitScoreTone,
  signalAgeLabel,
  type SkipReason,
} from "@/lib/venues/feed";
import type { VenueKind, VenueStatus, VenueTemperature } from "@/app/generated/prisma/enums";

/** The slice of a Venue row the feed card renders. */
export type HuntVenue = {
  id: string;
  name: string;
  city: string;
  country: string;
  kind: VenueKind;
  status: VenueStatus;
  /** 10.2c TIMING half: HOT (deciding now) / WARM (books entertainment) / SEED. */
  temperature: VenueTemperature;
  timingScore: number | null;
  /** Grounded facts proving they buy entertainment — first one leads the card. */
  entertainmentEvidence: string[];
  /** Find-only LinkedIn handoff (ADR-004) — link, never a stored name. */
  linkedinUrl: string | null;
  fitScore: number | null;
  fitReasons: string[];
  caution: string | null;
  lastSignalAt: Date | null;
  bookingEmail: string | null;
  contactSource: string | null;
  /** Evidence receipts (P10.1): freshest signals with WHERE we read them. */
  signals: { id: string; summary: string; sourceUrl: string }[];
  /** Named person published with the address (P10.5 confidence signal). */
  bookingContactName: string | null;
  /** P12.4: private field notes (names met, visits) — dashboard-only. */
  staffNotes: string | null;
  /** P12.4: set when the 180-day re-touch arc brought this venue back. */
  retouchedAt: Date | null;
  /** Travel Mode: the travel-window city, when this is a travel find (else null). */
  travelCity: string | null;
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

export const KIND_LABEL: Record<VenueKind, string> = {
  BAR: "Bar",
  ROOFTOP: "Rooftop",
  HOTEL: "Hotel",
  RESTAURANT: "Restaurant",
  EVENT_SPACE: "Event space",
  CLUB: "Club",
  OTHER: "Venue",
};

/** Hostname label for a source chip — "www." stripped; raw string on bad URLs. */
function hostLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.slice(0, 30);
  }
}

/** One chip per publication — three signals from one blog is one receipt. */
function dedupeByHost(signals: { id: string; summary: string; sourceUrl: string }[]) {
  const seen = new Set<string>();
  return signals.filter((s) => {
    const host = hostLabel(s.sourceUrl);
    if (seen.has(host)) return false;
    seen.add(host);
    return true;
  });
}

function VenueCard({
  venue,
  canPitch,
  profilePercent,
  businessName,
  homeCity,
  mailboxConnected,
  now,
}: {
  venue: HuntVenue;
  canPitch: boolean;
  profilePercent: number;
  businessName: string;
  homeCity: string;
  /** 10.5: a sending mailbox is connected — gates the "Send now" button. */
  mailboxConnected: boolean;
  now: Date;
}) {
  const score = venue.fitScore ?? 0;
  // Jurisdiction is recipient-side (the venue's country, ADR-004 D4). The mode
  // snapshot on the pitch wins (drafted under those rules); the live map covers
  // the note + footer for fresh renders.
  const jurisdiction = jurisdictionFor(venue.country);
  return (
    // White data card on the ink stage — never tilted (app rule). The id is
    // the NeedsYou queue's anchor target (P9.4) — scroll-mt clears the nav.
    <Card id={`venue-${venue.id}`} className="flex scroll-mt-20 flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold leading-tight text-ink-stage">{venue.name}</p>
          {/* Temperature chip (10.2c) — mono, no emoji (v2.1 LAW): timing is
              data, the card says the truth plainly. */}
          <span
            className={`mt-1.5 inline-block rounded-full px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] ${TEMPERATURE_CHIP[venue.temperature].className}`}
          >
            {TEMPERATURE_CHIP[venue.temperature].label}
          </span>
          {/* Warm again (P12.4): the re-touch arc brought this one back after
              180 silent days — fair to knock twice, and the card says so. */}
          {venue.retouchedAt && (
            <span className="ml-1.5 mt-1.5 inline-block rounded-full bg-cream px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage">
              Warm again — pitched 6+ months ago
            </span>
          )}
          {/* Travel Mode tag (no emoji, mono, cyan interface accent): marks a
              find from a travel window so travel finds are distinguishable. */}
          {venue.travelCity && (
            <span className="ml-1.5 mt-1.5 inline-block rounded-full bg-brand-cyan-soft px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage">
              Travel · {venue.travelCity}
            </span>
          )}
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

      {/* The honest line (10.2c): WARM/SEED cards lead with the proof that
          this venue actually buys entertainment — "Not currently looking —
          but books performers regularly", grounded in the first evidence fact. */}
      {venue.temperature !== "HOT" && venue.entertainmentEvidence.length > 0 && (
        <p className="mt-3 flex items-start gap-2 text-xs font-semibold text-ink-stage/80">
          <span aria-hidden className="mt-1.5 size-1 flex-none bg-brand-cyan" />
          Not currently looking — {venue.entertainmentEvidence[0]}
        </p>
      )}

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

      {/* Evidence receipts (P10.1): every claim above traces to a source the
          owner can open — provenance chips by hostname, deduped. */}
      {venue.signals.length > 0 && (
        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-stage/40">
            Sources
          </span>
          {dedupeByHost(venue.signals).map((s) => (
            <a
              key={s.id}
              href={s.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={s.summary}
              className="rounded-full bg-cream/70 px-2 py-0.5 font-mono text-[10px] font-bold text-ink-stage/60 transition-colors hover:text-brand-cyan"
            >
              {hostLabel(s.sourceUrl)} ↗
            </a>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-0.5">
        {(venue.lastSignalAt || venue.timingScore != null) && (
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/45">
            {venue.timingScore != null && <>{venue.timingScore}% short-term</>}
            {venue.timingScore != null && venue.lastSignalAt && " · "}
            {venue.lastSignalAt && <>Signal: {signalAgeLabel(venue.lastSignalAt, now)}</>}
          </p>
        )}
        {venue.bookingEmail && (
          // Provenance builds trust — where the agent found the contact. A
          // generic address (info@/hello@) is flagged (P10.5): the agent
          // won't auto-draft to it, and the owner should check it reaches
          // the booker before sending.
          <p className="text-[11px] text-ink-stage/45">
            Contact: {venue.contactSource ?? "published booking contact"}
            {contactConfidence(venue.bookingEmail, venue.bookingContactName) === "low" && (
              <>
                {" · "}
                <span aria-hidden className="mb-px mr-1 inline-block size-1 bg-neon-orange align-middle" />
                <span className="font-semibold text-ink-stage/70">verify before sending</span>
              </>
            )}
          </p>
        )}
        {venue.linkedinUrl && (
          // LinkedIn is find-only (ADR-004): the handoff card gets the link,
          // never a name scraped from it. The artist takes over personally.
          <p className="text-[11px] text-ink-stage/45">
            Events contact on{" "}
            <a
              href={venue.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-cyan hover:opacity-80"
            >
              LinkedIn
            </a>{" "}
            — you take over
          </p>
        )}
      </div>

      {/* The review surface (10.3): a drafted pitch auto-opens on the card —
          subject, body, jurisdiction note, Approve/Edit/Discard. */}
      {venue.status === "PITCH_DRAFTED" && venue.pitch && (
        <VenuePitchReview
          pitch={venue.pitch}
          jurisdictionNote={jurisdiction.note}
          mailboxConnected={mailboxConnected}
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

      {/* Private field notes (P12.4) — the residency game's memory. */}
      <VenueNotes venueId={venue.id} notes={venue.staffNotes} />

      {!canPitch && venue.status !== "PITCH_DRAFTED" && (
        <p className="mt-2 text-[11px] text-ink-stage/55">
          <Link href="/dashboard/settings#profile" className="font-semibold text-brand-cyan hover:opacity-80">
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
  mailboxConnected = false,
  subscribed = true,
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
  /** 10.5: a sending mailbox is connected — gates "Send now" on STANDARD cards. */
  mailboxConnected?: boolean;
  /** Subscribe-to-activate: unsubscribed tenants' scans never run. */
  subscribed?: boolean;
}) {
  const now = new Date();
  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Kicker>The hunt</Kicker>
          <h2 className="mt-1.5 text-xl font-black tracking-tight text-cream-bright">
            Venues your assistant found
          </h2>
        </div>
        {totalCount > 0 && <StatPill tone="teal">{totalCount} found</StatPill>}
      </div>

      {totalCount === 0 ? (
        // Typography-first empty state (v2.1 LAW rule 7) — no icons, ever.
        // State-aware: names the ACTUAL blocker (plan → city → profile) or,
        // when nothing blocks, says what happens next. Quiet mono links only —
        // the activation surfaces above own the loud CTA (audit C4).
        (() => {
          const linkCls =
            "font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-brand-cyan hover:opacity-80";
          const state = !subscribed
            ? {
                hint: "Your assistant is paused. Pick a plan and the hunt switches on — new openings and rooms for your act land here, scored, with the outreach drafted in your voice for you to approve.",
                cta: (
                  <Link href="/dashboard/settings#billing" className={linkCls}>
                    Choose your plan →
                  </Link>
                ),
              }
            : !homeCity
              ? {
                  hint: "Your assistant is on — it just doesn't know where to hunt yet. Set your home city and every scan combs it for new openings and rooms that fit your act.",
                  cta: (
                    <Link href="/dashboard/settings#hunt" className={linkCls}>
                      Set your home city →
                    </Link>
                  ),
                }
              : !canPitch
                ? {
                    hint: "Venues from your city land here after each scan. To unlock pitching, finish the profile the pitches are built from — video, photos, bio, a gig on your calendar — so your assistant never sends a thin one in your name.",
                    cta: (
                      <Link href="/dashboard/settings#profile" className={linkCls}>
                        Finish your profile ({profilePercent}%) →
                      </Link>
                    ),
                  }
                : {
                    hint: "You're set. Your assistant combs your city on every scan — new openings and rooms that fit your act land here scored, with the reasons spelled out and the outreach drafted for you to approve, usually by morning.",
                    cta: (
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-stage/45">
                        First scan queued — check back tomorrow
                      </span>
                    ),
                  };
          return (
            <EmptyState
              kicker="The hunt"
              title="The hunt begins here."
              accent="here."
              hint={state.hint}
              cta={state.cta}
            />
          );
        })()
      ) : venues.length === 0 ? (
        // Counted but all collapsed (P15 review): every found venue is a SEED
        // (or past the cap), so the default HOT/WARM feed is empty. Say so and
        // hand over the expansion instead of rendering a blank grid under "N found".
        <p className="text-sm text-cream/70">
          {totalCount} {totalCount === 1 ? "venue is" : "venues are"} on file as longer-term
          introductions — nothing hot right now.{" "}
          <Link
            href="/dashboard?hunt=all"
            className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-brand-cyan hover:opacity-80"
          >
            View all →
          </Link>
        </p>
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
                mailboxConnected={mailboxConnected}
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
