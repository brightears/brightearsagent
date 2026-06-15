// "In play" — the post-send venue-tracking surface (audit C2). The Hunt feed
// (components/hunt-feed.tsx) only shows venues UP TO the pitch (DISCOVERED →
// PITCH_DRAFTED); once a pitch is sent the venue becomes PITCHED and leaves the
// feed. Because the artist sends from their OWN Gmail with gmail.send (ADR-004,
// send-only — no read scope), there's no automated capture of the venue's
// reply, so a pitched venue would otherwise vanish with nowhere to track it.
//
// This section lists every in-play venue (PITCHED / REPLIED / IN_CONVERSATION /
// BOOKED / DEAD, tenant-scoped) and gives the owner manual status controls to
// move it along by hand. Server component — the status picker is a native
// <details> popover with plain forms bound to the tenant-scoped server action
// (the same no-JS pattern as the Hunt's Skip menu); the action re-checks
// tenancy + the allowed transition server-side.
//
// Design LAW (docs/DESIGN.md v2.1): reuse VENUE_STATUS_META, mono Kickers, no
// emoji ever. White data cards on the ink stage — never tilted.

import { Badge, EmptyState, Kicker, StatPill, VENUE_STATUS_META } from "@/components/ui";
import { setVenueStatusForm } from "@/app/actions/venues";
import { IN_PLAY_TARGET_STATUSES } from "@/lib/venues/feed";
import type { VenueKind, VenueStatus } from "@/app/generated/prisma/enums";

/** The slice of a Venue row the in-play row renders. */
export type InPlayVenue = {
  id: string;
  name: string;
  city: string;
  country: string;
  kind: VenueKind;
  status: VenueStatus;
  pitchedAt: Date | null;
  /** Travel Mode: the travel-window city, when this is a travel find (else null). */
  travelCity: string | null;
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

function sentAgoLabel(pitchedAt: Date | null, now: Date): string | null {
  if (!pitchedAt) return null;
  const days = Math.floor((now.getTime() - pitchedAt.getTime()) / (24 * 3600 * 1000));
  if (days <= 0) return "Pitched today";
  if (days === 1) return "Pitched yesterday";
  return `Pitched ${days} days ago`;
}

function StatusPicker({ venueId, current }: { venueId: string; current: VenueStatus }) {
  return (
    // Native <details> popover — no client JS, mirrors the Hunt Skip menu.
    <details className="relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border-[1.5px] border-ink-stage/30 px-3 py-1 text-xs font-semibold text-ink-stage/80 transition-colors hover:border-ink-stage/60 [&::-webkit-details-marker]:hidden">
        Update status
        <span aria-hidden className="text-ink-stage/40">
          ›
        </span>
      </summary>
      <div className="absolute right-0 top-full z-10 mt-2 w-44 rounded-2xl border border-ink-stage/10 bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
        <p className="px-2 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-stage/45">
          Move to
        </p>
        {IN_PLAY_TARGET_STATUSES.map((target) => (
          <form key={target} action={setVenueStatusForm.bind(null, venueId, target)}>
            <button
              type="submit"
              disabled={target === current}
              className="w-full rounded-xl px-2 py-1.5 text-left text-sm font-semibold text-ink-stage/80 transition-colors hover:bg-cream disabled:opacity-40"
            >
              {VENUE_STATUS_META[target].label}
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}

function InPlayRow({ venue, now }: { venue: InPlayVenue; now: Date }) {
  const meta = VENUE_STATUS_META[venue.status];
  const sent = sentAgoLabel(venue.pitchedAt, now);
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-stage/10 bg-white p-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-stage">
          {venue.name}
          {/* Travel Mode tag (mono, cyan interface accent, no emoji). */}
          {venue.travelCity && (
            <span className="inline-block rounded-full bg-brand-cyan-soft px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage">
              Travel · {venue.travelCity}
            </span>
          )}
        </p>
        <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-stage/45">
          {KIND_LABEL[venue.kind]} · {venue.city}, {venue.country}
          {sent ? ` · ${sent}` : ""}
        </p>
      </div>
      {/* Status badge reuses VENUE_STATUS_META's tone (single source of truth). */}
      <span className="flex-none">
        <Badge tone={meta.badgeTone}>{meta.label}</Badge>
      </span>
      <StatusPicker venueId={venue.id} current={venue.status} />
    </li>
  );
}

export function InPlaySection({ venues }: { venues: InPlayVenue[] }) {
  const now = new Date();
  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Kicker>In play</Kicker>
          <h2 className="mt-1.5 text-xl font-black tracking-tight text-cream-bright">
            Venues you&apos;ve pitched
          </h2>
        </div>
        {venues.length > 0 && <StatPill tone="teal">{venues.length} in play</StatPill>}
      </div>

      {venues.length === 0 ? (
        <EmptyState
          kicker="In play"
          title="No pitches sent yet."
          accent="yet."
          hint="When you send a venue pitch from the Hunt above, it lands here so you can track the reply by hand — mark it Talking, Booked or Gone quiet as it moves."
        />
      ) : (
        <ul className="space-y-3">
          {venues.map((venue) => (
            <InPlayRow key={venue.id} venue={venue} now={now} />
          ))}
        </ul>
      )}
    </section>
  );
}
