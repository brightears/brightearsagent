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

import { VenueNotes } from "@/components/venue-notes";
import { Badge, EmptyState, Kicker, StatPill, VENUE_STATUS_META } from "@/components/ui";
import { setVenueStatusForm } from "@/app/actions/venues";
import { IN_PLAY_TARGET_STATUSES } from "@/lib/venues/feed";
import type { VenueKind, VenueStatus } from "@/app/generated/prisma/enums";
import type { Locale } from "@/lib/i18n/config";

/** The slice of a Venue row the in-play row renders. */
export type InPlayVenue = {
  id: string;
  name: string;
  city: string;
  country: string;
  kind: VenueKind;
  status: VenueStatus;
  pitchedAt: Date | null;
  /** P12.4: private field notes (names met, visits) — dashboard-only. */
  staffNotes: string | null;
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

function sentAgoLabel(pitchedAt: Date | null, now: Date, locale: Locale): string | null {
  if (!pitchedAt) return null;
  const days = Math.floor((now.getTime() - pitchedAt.getTime()) / (24 * 3600 * 1000));
  if (locale === "th") {
    if (days <= 0) return "ส่งข้อความแนะนำตัววันนี้";
    if (days === 1) return "ส่งข้อความแนะนำตัวเมื่อวาน";
    return `ส่งข้อความแนะนำตัวเมื่อ ${days} วันก่อน`;
  }
  if (days <= 0) return "Pitched today";
  if (days === 1) return "Pitched yesterday";
  return `Pitched ${days} days ago`;
}

const TH_STATUS: Partial<Record<VenueStatus, string>> = {
  PITCHED: "ส่งแล้ว",
  REPLIED: "ตอบกลับแล้ว",
  IN_CONVERSATION: "กำลังคุย",
  BOOKED: "จองงานแล้ว",
  DEAD: "เงียบไป",
};

function StatusPicker({ venueId, current, locale }: { venueId: string; current: VenueStatus; locale: Locale }) {
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  return (
    // Native <details> popover — no client JS, mirrors the Hunt Skip menu.
    <details className="relative">
      <summary className="inline-flex cursor-pointer list-none items-center gap-1.5 rounded-full border-[1.5px] border-ink-stage/30 px-3 py-1 text-xs font-semibold text-ink-stage/80 transition-colors hover:border-ink-stage/60 [&::-webkit-details-marker]:hidden">
        {c("Update status", "อัปเดตสถานะ")}
        <span aria-hidden className="text-ink-stage/40">
          ›
        </span>
      </summary>
      <div className="absolute right-0 top-full z-10 mt-2 w-44 rounded-2xl border border-ink-stage/10 bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
        <p className="px-2 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-stage/45">
          {c("Move to", "เปลี่ยนเป็น")}
        </p>
        {IN_PLAY_TARGET_STATUSES.map((target) => (
          <form key={target} action={setVenueStatusForm.bind(null, venueId, target)}>
            <button
              type="submit"
              disabled={target === current}
              className="w-full rounded-xl px-2 py-1.5 text-left text-sm font-semibold text-ink-stage/80 transition-colors hover:bg-cream disabled:opacity-40"
            >
              {locale === "th" ? TH_STATUS[target] : VENUE_STATUS_META[target].label}
            </button>
          </form>
        ))}
      </div>
    </details>
  );
}

function InPlayRow({ venue, now, locale }: { venue: InPlayVenue; now: Date; locale: Locale }) {
  const meta = VENUE_STATUS_META[venue.status];
  const sent = sentAgoLabel(venue.pitchedAt, now, locale);
  const thKind: Record<VenueKind, string> = { BAR: "บาร์", ROOFTOP: "รูฟท็อป", HOTEL: "โรงแรม", RESTAURANT: "ร้านอาหาร", EVENT_SPACE: "สถานที่จัดงาน", CLUB: "คลับ", OTHER: "สถานที่" };
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-stage/10 bg-white p-4 shadow-sm">
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold text-ink-stage">
          {venue.name}
          {/* Travel Mode tag (mono, cyan interface accent, no emoji). */}
          {venue.travelCity && (
            <span className="inline-block rounded-full bg-brand-cyan-soft px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage">
              {locale === "th" ? "เดินทาง" : "Travel"} · {venue.travelCity}
            </span>
          )}
        </p>
        <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-ink-stage/45">
          {locale === "th" ? thKind[venue.kind] : KIND_LABEL[venue.kind]} · {venue.city}, {venue.country}
          {sent ? ` · ${sent}` : ""}
        </p>
      </div>
      {/* Status badge reuses VENUE_STATUS_META's tone (single source of truth). */}
      <span className="flex-none">
        <Badge tone={meta.badgeTone}>{locale === "th" ? TH_STATUS[venue.status] : meta.label}</Badge>
      </span>
      <StatusPicker venueId={venue.id} current={venue.status} locale={locale} />
      {/* Private field notes (P12.4): the residency game is played in person
          over months — names met and visits live on the card. */}
      <div className="w-full">
        <VenueNotes venueId={venue.id} notes={venue.staffNotes} locale={locale} />
      </div>
    </li>
  );
}

export function InPlaySection({ venues, locale }: { venues: InPlayVenue[]; locale: Locale }) {
  const now = new Date();
  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Kicker>{locale === "th" ? "กำลังติดตาม" : "In play"}</Kicker>
          <h2 className="mt-1.5 text-xl font-black tracking-tight text-cream-bright">
            {locale === "th" ? "สถานที่ที่คุณส่งข้อความแนะนำตัวแล้ว" : "Venues you've pitched"}
          </h2>
        </div>
        {venues.length > 0 && <StatPill tone="teal">{locale === "th" ? `กำลังติดตาม ${venues.length}` : `${venues.length} in play`}</StatPill>}
      </div>

      {venues.length === 0 ? (
        <EmptyState
          kicker={locale === "th" ? "กำลังติดตาม" : "In play"}
          title={locale === "th" ? "ยังไม่ได้ส่งข้อความแนะนำตัว" : "No pitches sent yet."}
          accent={locale === "th" ? "ยังไม่ได้ส่ง" : "yet."}
          hint={locale === "th" ? "เมื่อส่งข้อความแนะนำตัวจากรายการค้นหาด้านบน สถานที่จะมาอยู่ที่นี่ให้คุณติดตามและเปลี่ยนสถานะเป็น กำลังคุย จองงานแล้ว หรือเงียบไป" : "When you send a venue pitch from the Hunt above, it lands here so you can track the reply by hand — mark it Talking, Booked or Gone quiet as it moves."}
        />
      ) : (
        <ul className="space-y-3">
          {venues.map((venue) => (
            <InPlayRow key={venue.id} venue={venue} now={now} locale={locale} />
          ))}
        </ul>
      )}
    </section>
  );
}
