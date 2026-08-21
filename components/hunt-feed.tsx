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
import type {
  ContactEnrichmentState,
  VenueKind,
  VenueStatus,
  VenueTemperature,
} from "@/app/generated/prisma/enums";
import { getTranslations } from "@/lib/i18n/server";
import type { Locale } from "@/lib/i18n/config";
import type { MessageKey, Translator } from "@/lib/i18n/messages";

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
  contactState: ContactEnrichmentState | null;
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
const KIND_KEYS: Record<VenueKind, MessageKey> = {
  BAR: "dashboard.hunt.kind.bar",
  ROOFTOP: "dashboard.hunt.kind.rooftop",
  HOTEL: "dashboard.hunt.kind.hotel",
  RESTAURANT: "dashboard.hunt.kind.restaurant",
  EVENT_SPACE: "dashboard.hunt.kind.eventSpace",
  CLUB: "dashboard.hunt.kind.club",
  OTHER: "dashboard.hunt.kind.other",
};

const THAI_SKIP_REASONS: Record<SkipReason, string> = {
  WRONG_VIBE: "บรรยากาศไม่เหมาะ",
  TOO_FAR: "ไกลเกินไป",
  BELOW_FEE: "ค่าจ้างต่ำกว่าเรตของฉัน",
  NO_ENTERTAINMENT: "ไม่รับการแสดงประเภทของฉัน",
  STALE_OR_CLOSED: "ปิดแล้วหรือข้อมูลเก่า",
  NOT_INTERESTED: "ไม่สนใจ",
};

function relativeSignalAge(date: Date, now: Date, locale: Locale): string {
  if (locale === "en") return signalAgeLabel(date, now);
  const days = Math.max(0, Math.round((now.getTime() - date.getTime()) / 86_400_000));
  if (days === 0) return "วันนี้";
  if (days < 30) return `${days} วันที่แล้ว`;
  const months = Math.round(days / 30);
  return `${months} เดือนที่แล้ว`;
}

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
  postalAddress,
  mailboxConnected,
  now,
  locale,
  t,
}: {
  venue: HuntVenue;
  canPitch: boolean;
  profilePercent: number;
  businessName: string;
  homeCity: string;
  postalAddress: string;
  /** 10.5: a sending mailbox is connected — gates the "Send now" button. */
  mailboxConnected: boolean;
  now: Date;
  locale: Locale;
  t: Translator;
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
            {locale === "th"
              ? ({ HOT: "โอกาสเร่งด่วน", WARM: "น่าสนใจ", SEED: "ระยะยาว" } as const)[venue.temperature]
              : TEMPERATURE_CHIP[venue.temperature].label}
          </span>
          {/* Warm again (P12.4): the re-touch arc brought this one back after
              180 silent days — fair to knock twice, and the card says so. */}
          {venue.retouchedAt && (
            <span className="ml-1.5 mt-1.5 inline-block rounded-full bg-cream px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage">
              {t("dashboard.hunt.warmAgain")}
            </span>
          )}
          {/* Travel Mode tag (no emoji, mono, cyan interface accent): marks a
              find from a travel window so travel finds are distinguishable. */}
          {venue.travelCity && (
            <span className="ml-1.5 mt-1.5 inline-block rounded-full bg-brand-cyan-soft px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage">
              {t("dashboard.hunt.travel", { city: venue.travelCity })}
            </span>
          )}
          <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-stage/50">
            {t(KIND_KEYS[venue.kind])}
          </p>
          <p className="mt-0.5 text-xs text-ink-stage/60">
            {venue.city}, {venue.country}
          </p>
        </div>
        <span
          className={`flex-none rounded-full px-2.5 py-1 font-mono text-sm font-bold ${FIT_CHIP[fitScoreTone(score)]}`}
          title={t("dashboard.hunt.fitScore", { score })}
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
          {t("dashboard.hunt.notLooking", { evidence: venue.entertainmentEvidence[0] })}
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
            {t("dashboard.hunt.sources")}
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
            {venue.timingScore != null && <>{t("dashboard.hunt.shortTerm", { score: venue.timingScore })}</>}
            {venue.timingScore != null && venue.lastSignalAt && " · "}
            {venue.lastSignalAt && <>{t("dashboard.hunt.signal", { age: relativeSignalAge(venue.lastSignalAt, now, locale) })}</>}
          </p>
        )}
        {venue.bookingEmail && (
          // Provenance builds trust — where the agent found the contact. A
          // generic address (info@/hello@) is flagged (P10.5): the agent
          // won't auto-draft to it, and the owner should check it reaches
          // the booker before sending.
          <p className="text-[11px] text-ink-stage/45">
            {t("dashboard.hunt.contact", {
              source: venue.contactSource ?? t("dashboard.hunt.publishedContact"),
            })}
            {contactConfidence(
              venue.bookingEmail,
              venue.bookingContactName,
              venue.contactState,
            ) === "low" && (
              <>
                {" · "}
                <span aria-hidden className="mb-px mr-1 inline-block size-1 bg-neon-orange align-middle" />
                <span className="font-semibold text-ink-stage/70">{t("dashboard.hunt.verify")}</span>
              </>
            )}
          </p>
        )}
        {venue.linkedinUrl && (
          // LinkedIn is find-only (ADR-004): the handoff card gets the link,
          // never a name scraped from it. The artist takes over personally.
          <p className="text-[11px] text-ink-stage/45">
            {locale === "th" ? "มีผู้ติดต่อด้านอีเวนต์บน " : "Events contact on "}
            <a
              href={venue.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-brand-cyan hover:opacity-80"
            >
              LinkedIn
            </a>{" "}
            {locale === "th" ? " — คุณดำเนินการต่อเอง" : " — you take over"}
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
          postalAddressReady={!!postalAddress.trim()}
          footer={pitchFooter({
            mode: jurisdiction.mode,
            businessName,
            city: homeCity,
            postalAddress,
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
              title={t("dashboard.hunt.pitchLockedTitle")}
            >
              {t("dashboard.hunt.pitchLocked")}
            </button>
          )}

          {/* One-tap skip reason picker — native <details> popover, no JS. */}
          <details className="relative">
            <summary
              className={`${buttonStyles.secondaryOnLight} inline-block cursor-pointer list-none px-3.5 py-1.5 text-sm [&::-webkit-details-marker]:hidden`}
            >
              {t("dashboard.hunt.notFit")}
            </summary>
            <div className="absolute left-0 top-full z-10 mt-2 w-44 rounded-2xl border border-ink-stage/10 bg-white p-2 shadow-[0_16px_40px_rgba(0,0,0,0.25)]">
              <p className="px-2 pb-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-ink-stage/45">
                {t("dashboard.hunt.whatMissed")}
              </p>
              {(Object.keys(SKIP_REASONS) as SkipReason[]).map((reason) => (
                <form key={reason} action={skipVenueForm.bind(null, venue.id, reason)}>
                  <button
                    type="submit"
                    className="w-full rounded-xl px-2 py-1.5 text-left text-sm font-semibold text-ink-stage/80 transition-colors hover:bg-cream"
                  >
                    {locale === "th" ? THAI_SKIP_REASONS[reason] : SKIP_REASONS[reason]}
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
            {t("dashboard.hunt.finishProfile")}
          </Link>{" "}
          {t("dashboard.hunt.unlock", { percent: profilePercent })}
        </p>
      )}
    </Card>
  );
}

/** How many cards show before "view all" (?hunt=all) expands the rail. */
export const HUNT_CAP = 8;

export async function HuntSection({
  venues,
  totalCount,
  expanded,
  canPitch,
  profilePercent,
  businessName,
  homeCity,
  postalAddress,
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
  /** Physical sender identity appended to approved outreach. */
  postalAddress: string;
  /** 10.5: a sending mailbox is connected — gates "Send now" on STANDARD cards. */
  mailboxConnected?: boolean;
  /** Subscribe-to-activate: unsubscribed tenants' scans never run. */
  subscribed?: boolean;
}) {
  const { locale, t } = await getTranslations();
  const now = new Date();
  return (
    <section className="mb-10">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <Kicker>{t("dashboard.hunt.kicker")}</Kicker>
          <h2 className="mt-1.5 text-xl font-black tracking-tight text-cream-bright">
            {t("dashboard.hunt.title")}
          </h2>
        </div>
        {totalCount > 0 && <StatPill tone="teal">{t("dashboard.hunt.found", { count: totalCount })}</StatPill>}
      </div>
      {totalCount > 0 && (
        <p className="-mt-1 mb-4 max-w-2xl text-sm leading-relaxed text-cream/55">
          {t("dashboard.hunt.reviewHint")}
        </p>
      )}

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
                hint: t("dashboard.hunt.paused"),
                cta: (
                  <Link href="/dashboard/settings#billing" className={linkCls}>
                    {t("dashboard.hunt.choosePlan")}
                  </Link>
                ),
              }
            : !homeCity
              ? {
                  hint: t("dashboard.hunt.noCity"),
                  cta: (
                    <Link href="/dashboard/settings#hunt" className={linkCls}>
                      {t("dashboard.hunt.setCity")}
                    </Link>
                  ),
                }
              : !canPitch
                ? {
                    hint: t("dashboard.hunt.noProfile"),
                    cta: (
                      <Link href="/dashboard/settings#profile" className={linkCls}>
                        {t("dashboard.hunt.finishCta", { percent: profilePercent })}
                      </Link>
                    ),
                  }
                : {
                    hint: t("dashboard.hunt.ready"),
                    cta: (
                      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-ink-stage/45">
                        {t("dashboard.hunt.queued")}
                      </span>
                    ),
                  };
          return (
            <EmptyState
              kicker={t("dashboard.hunt.kicker")}
              title={t("dashboard.hunt.emptyTitle")}
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
          {t("dashboard.hunt.longTerm", { count: totalCount })}{" "}
          <Link
            href="/dashboard?hunt=all"
            className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-brand-cyan hover:opacity-80"
          >
            {t("dashboard.hunt.viewAll")}
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
                postalAddress={postalAddress}
                mailboxConnected={mailboxConnected}
                now={now}
                locale={locale}
                t={t}
              />
            ))}
          </div>
          {!expanded && totalCount > venues.length && (
            <p className="mt-4">
              <Link
                href="/dashboard?hunt=all"
                className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-brand-cyan hover:opacity-80"
              >
                {t("dashboard.hunt.viewAllCount", { count: totalCount })}
              </Link>
            </p>
          )}
        </>
      )}
    </section>
  );
}
