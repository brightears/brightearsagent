"use client";

// The 5-step onboarding wizard (/onboarding) — every new trial walks through
// this once. Design brief: bright, colorful, fun (CLAUDE.md), under 10 minutes.
// State lives client-side; each step persists via server actions on "Next":
//   1 Your business   → saveBusinessBasics (app/actions/onboarding.ts)
//   2 What you sell   → createPackage (app/actions/packages.ts, reused)
//   3 Your voice      → saveVoiceSamples
//   4 Your calendar   → addBookedDates (skippable)
//   5 Connect leads   → walkthroughs + live verifier polling /api/onboarding/verify

import {
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useActionState,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import Link from "next/link";
import {
  addBookedDates,
  addResidency,
  saveArtistProfile,
  saveBusinessBasics,
  saveVoiceSamples,
} from "@/app/actions/onboarding";
import { startCheckout } from "@/app/actions/billing";
import { buttonStyles, BrightEarsLogo, Card, CheckMark as UiCheckMark } from "@/components/ui";
import { RingsBackdrop, StickerChip } from "@/components/collage";
import { CopyButton } from "@/components/settings-form";
import { PhotoUploader } from "@/components/photo-uploader";
import { COUNTRIES, currencyForCountry } from "@/lib/geo/countries";
import { stripToneNote } from "@/lib/voice/tone-note";
import type { PerformerKind } from "@/app/generated/prisma/enums";

type ActionResult = { ok: boolean; error?: string } | null;

// Stable no-op subscription for useSyncExternalStore reads of browser-only,
// never-changing values (e.g. the device timezone). Module-scope so the store
// never resubscribes across renders.
const subscribeToNothing = () => () => {};

// Form styling per docs/DESIGN.md v2 — cream-tinted inputs on white cards, cyan focus ring.
const inputStyles =
  "w-full rounded-xl border border-cream bg-cream/40 px-3 py-2 text-base sm:text-sm text-ink-stage placeholder:text-ink-stage/35 focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 transition-colors";
const labelStyles = "block text-xs font-semibold uppercase tracking-wide text-ink-stage/60 mb-1";

// ---------------------------------------------------------------------------
// Step definitions — progress chips walk the v2 spectrum: cyan → magenta →
// orange (then around again). Text pairings per docs/DESIGN.md: ink on
// cyan/orange, white on magenta.
// ---------------------------------------------------------------------------

const STEPS = [
  { label: "Your business", chip: "bg-brand-cyan text-ink-stage" },
  { label: "Who you are", chip: "bg-neon-magenta text-white" },
  { label: "Your voice", chip: "bg-neon-orange text-ink-stage" },
  { label: "Your calendar", chip: "bg-brand-cyan text-ink-stage" },
  { label: "Connect leads", chip: "bg-neon-magenta text-white" },
] as const;

const KINDS: { kind: PerformerKind; label: string }[] = [
  { kind: "DJ", label: "DJ" },
  { kind: "BAND", label: "Band" },
  { kind: "SINGER", label: "Singer" },
  { kind: "MAGICIAN", label: "Magician" },
  { kind: "DANCER", label: "Dancer" },
  { kind: "MC", label: "MC / Host" },
  { kind: "PHOTO_BOOTH", label: "Photo booth" },
  { kind: "MUSICIAN", label: "Musician" },
  { kind: "COMEDIAN", label: "Comedian" },
  { kind: "OTHER", label: "Other" },
];

// Country list = the shared ISO-3166-1 source (lib/geo/countries.ts), already
// sorted and with sanctioned jurisdictions filtered out.

const TONES = ["Fun & casual", "Warm & professional", "High-energy"] as const;
type Tone = (typeof TONES)[number];

// Weekday chips for the residency logger (value = getUTCDay: 0=Sun..6=Sat).
const WEEKDAYS: { label: string; value: number }[] = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

/** today / today + n months as YYYY-MM-DD, for the residency date defaults. */
function isoToday(offsetMonths = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offsetMonths);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Props + shared bits
// ---------------------------------------------------------------------------

export interface WizardBusiness {
  slug: string;
  name: string;
  ownerName: string;
  performerKind: PerformerKind;
  country: string;
  /** Home base = serviceCities[0]; the wizard collects the first one so the
   *  Hunt is never structurally idle. More cities live in the Control Room. */
  homeCity: string;
  timezone: string;
  websiteUrl: string | null;
  voiceSamples: string | null;
  voiceGreeting: string | null;
  voiceSignoff: string | null;
  voiceUsesEmoji: boolean | null;
  voicePhrases: string | null;
}

// Step 3 voice state — multiple sample boxes + the structured voice signals.
type VoiceState = {
  samples: string[]; // one per box; non-empty boxes are joined on save
  tones: Tone[];
  greeting: string;
  signoff: string;
  emoji: boolean | null; // null = unset, true = now & then, false = never
  phrases: string;
};

// Step 2 state — WHO the artist is + the work/pricing dials (replaced packages,
// June 2026). Fees are whole-currency strings for the inputs; the action
// converts to cents. Currency is derived from the step-1 country, not stored here.
export interface WizardProfile {
  genres: string; // comma-separated tags (label adapts per performer kind)
  headline: string; // the one-line "vibe" descriptor
  bio: string;
  videoLinks: string; // newline-separated YouTube/Vimeo links
  socialLinks: string; // newline-separated IG/TikTok/SoundCloud/Spotify/etc.
  photoUrls: string[]; // uploaded R2 image URLs (or empty until uploads are on)
  riderNotes: string; // "how you perform & what you need"
  gigTypes: string[]; // "one-off" / "residency"
  acceptsTravel: boolean;
  feeFloor: string; // whole currency units (one-off floor)
  residencyRate: string; // whole currency units (per-night residency rate)
}

// Per-performer-kind copy for step 2 — so a magician never sees "open format,
// house, disco". Keyed to the PerformerKind enum; OTHER is the safe fallback.
// Sourced from per-kind booking-platform research (June 2026).
type KindCopy = {
  styleLabel: string;
  stylePlaceholder: string;
  styleHint: string;
  oneLinerPlaceholder: string;
  bioPlaceholder: string;
  showcaseNote: string; // what media actually wins bookings for this kind
  socialPlaceholder: string;
  riderLabel: string;
  riderPlaceholder: string;
  gigTypeHint: string; // how one-off vs residency reads for this kind
};

const PERFORMER_KIND_COPY: Record<PerformerKind, KindCopy> = {
  DJ: {
    styleLabel: "Your sound",
    stylePlaceholder: "house, open-format, hip-hop, techno, Top 40, disco, weddings",
    styleHint: "The genres you actually fill floors with — pick a few, add your own.",
    oneLinerPlaceholder: "Open-format DJ keeping the floor moving from dinner to last call",
    bioPlaceholder:
      "A few lines in your own voice: how you read a room, the nights you play (residencies, weddings, brand nights), and what makes your set yours.",
    showcaseNote:
      "Bookers want to hear you read a room — lead with a full mix or set (SoundCloud / Mixcloud), then a short clip of you working a live floor.",
    socialPlaceholder: "https://soundcloud.com/you\nhttps://mixcloud.com/you\nhttps://instagram.com/you",
    riderLabel: "How you play & what you need",
    riderPlaceholder:
      "I bring USBs, headphones, my own controller if needed. Venue provides a DJ booth or table, CDJs + mixer (or I bring my own), one booth monitor, and power near the booth. Setup 30 min before doors.",
    gigTypeHint: "Residency = a recurring weekly/monthly slot at one venue (steady, lower per-night); one-off = parties, weddings and brand nights at a premium.",
  },
  BAND: {
    styleLabel: "Your style",
    stylePlaceholder: "soul & funk, Top 40 covers, indie rock, jazz, wedding band, Latin",
    styleHint: "What you play and the vibe you bring — a few tags is plenty.",
    oneLinerPlaceholder: "5-piece soul & funk band that turns any room into a dance floor",
    bioPlaceholder:
      "Who you are as a live act: the line-up, the rooms you fill (weddings, corporate, festivals), and how you tailor a setlist to the night.",
    showcaseNote:
      "Live video is the single biggest trust-builder — lead with one strong full-song live clip (YouTube), then Spotify / Bandcamp for the studio sound.",
    socialPlaceholder: "https://youtube.com/@you\nhttps://open.spotify.com/artist/...\nhttps://instagram.com/you",
    riderLabel: "How you perform & what you need",
    riderPlaceholder:
      "5-piece (vocals, guitar, bass, keys, drums). Venue provides PA + engineer, monitor mixes, min stage size, power circuits. We bring our own backline. Load-in 90 min, soundcheck 45 min. Stage plot + input list available.",
    gigTypeHint: "Residency = a regular recurring slot (e.g. weekly at a hotel/bar) at a steady rate; one-off = weddings and corporate at a higher per-event fee.",
  },
  SINGER: {
    styleLabel: "Your style",
    stylePlaceholder: "jazz standards, soul, acoustic pop, wedding ceremonies, lounge, R&B",
    styleHint: "The genres and moments you sing best — ceremonies, lounges, parties.",
    oneLinerPlaceholder: "Soul & jazz vocalist for weddings, lounges and intimate events",
    bioPlaceholder:
      "What you do to a room: the styles you sing, whether you perform to tracks / with a pianist / with a band, and the moments you own (ceremonies, lounges, parties).",
    showcaseNote:
      "A clean live vocal clip is what closes the booking — lead with one live performance video (YouTube), then Spotify for your recorded work.",
    socialPlaceholder: "https://youtube.com/@you\nhttps://open.spotify.com/artist/...\nhttps://instagram.com/you",
    riderLabel: "How you perform & what you need",
    riderPlaceholder:
      "Solo vocalist. I perform with backing tracks (I bring on USB / send ahead) or live with a pianist. Venue provides PA with an aux/DI input, a vocal mic + stand, one monitor, power. Setup 20 min.",
    gigTypeHint: "Residency = a recurring slot (e.g. a weekly hotel lounge set) at a steady rate; one-off = weddings and private events at a higher per-event fee.",
  },
  MUSICIAN: {
    styleLabel: "Your style",
    stylePlaceholder: "solo acoustic guitar, jazz piano, saxophone, singer-songwriter, cello, looping",
    styleHint: "Your instrument and the mood you create — name a few styles you cover.",
    oneLinerPlaceholder: "Solo acoustic guitarist & singer for relaxed dinners and ceremonies",
    bioPlaceholder:
      "How you fill a space without overwhelming it: your instrument, the moods you cover, and the events you play (dinners, ceremonies, lounges).",
    showcaseNote:
      "A raw live clip proves you can hold a room on your own — lead with one live video (YouTube), then Spotify / Bandcamp for the recorded sound.",
    socialPlaceholder: "https://youtube.com/@you\nhttps://open.spotify.com/artist/...\nhttps://bandcamp.com/you",
    riderLabel: "How you perform & what you need",
    riderPlaceholder:
      "Solo acoustic act (guitar + vocals). I bring my own instrument, amp and a small PA for rooms up to ~80. Larger rooms: venue provides PA + DI and a vocal mic, one monitor, power. Footprint ~2x2m. Setup 20 min.",
    gigTypeHint: "Residency = a recurring weekly/monthly venue slot at a steady per-night rate; one-off = weddings and private events at a higher fee.",
  },
  MAGICIAN: {
    styleLabel: "What kind of magic do you do?",
    stylePlaceholder: "close-up, strolling, parlour, stage illusion, mentalism, kids & family, comedy magic",
    styleHint: "Add every style you perform — we use these to match you to the right rooms and events.",
    oneLinerPlaceholder: "Close-up magician turning cocktail hours into the moment everyone talks about",
    bioPlaceholder:
      "A few sentences in your own voice: the kind of magic you do, the rooms you light up, how long you've performed, a signature effect, and the feeling guests walk away with.",
    showcaseNote:
      "A 2-3 minute demo reel is what books magicians — front-load real audience reactions and the climax of a routine (the vanish, the reveal, the gasp). Add a few crowd-reaction photos.",
    socialPlaceholder: "https://instagram.com/you\nhttps://youtube.com/@you\nhttps://tiktok.com/@you",
    riderLabel: "How you perform & what you need",
    riderPlaceholder:
      "Strolling close-up: I move table to table, no stage needed. Parlour/stage: ~10x10 ft performance area with clear sightlines, a sturdy table, a wireless mic for rooms over ~40 guests, decent lighting. Sets run [length]. I bring my own props; I arrive [setup time] early.",
    gigTypeHint: "Most magic is one-off events — but residency is real too: a weekly strolling night at a restaurant/bar, a resident speakeasy spot, or a resort/cruise season.",
  },
  DANCER: {
    styleLabel: "Your styles of dance & performance",
    stylePlaceholder: "contemporary, hip-hop, go-go, burlesque, fire / flow, LED, aerial, cultural, stilt",
    styleHint: "Add every style and act you perform — bookers search by these, and the AI uses them to pitch the right rooms.",
    oneLinerPlaceholder: "High-energy go-go and LED dancers who turn a dance floor into a show",
    bioPlaceholder:
      "Who you are and what they're getting: your training, the acts you offer (solo / duo / troupe), the rooms you light up, and signature moments (fire finale, aerial drop, choreographed reveal).",
    showcaseNote:
      "Video is what books a dancer — a 60-90 second performance reel cut from real shows. Then action photos: mid-move, in costume, in front of a crowd, plus specialty shots (fire lit, aerial in the air, LED glowing).",
    socialPlaceholder: "https://instagram.com/you\nhttps://tiktok.com/@you\nhttps://youtube.com/@you",
    riderLabel: "How you perform & what you need",
    riderPlaceholder:
      "Set length & format (e.g. 30 min of dancing per hour, or roaming). Floor: clean, flat, dry surface and how much clear space you need. Aerial: ceiling height + a load-tested rigging point. Fire: outdoor / high ceiling, safe clearance, permits. Private changing room. Music format. Power for LED/go-boxes. Setup / rigging time.",
    gigTypeHint: "Residency is very real for dancers — a regular go-go or themed night at a club/bar/rooftop; one-off = weddings, corporate and brand events.",
  },
  MC: {
    styleLabel: "What you host",
    stylePlaceholder: "wedding host, corporate emcee, awards & gala host, charity auctioneer, hype MC, quiz host",
    styleHint: "Add every kind of room you can carry — the more specific, the better we match you.",
    oneLinerPlaceholder: "The host who keeps the night running on time and the room on their feet",
    bioPlaceholder:
      "What a couple or a company gets when you hold the mic: the rooms you've worked, how you read and lift a crowd, languages you host in, and the energy you bring.",
    showcaseNote:
      "A 60-90 second hosting showreel wins bookings — clients want to see you live: reading the room, landing a line, running an awards reveal or auction. Clips from events like the ones you want matter most.",
    socialPlaceholder: "https://youtube.com/@you\nhttps://instagram.com/you\nhttps://linkedin.com/in/you",
    riderLabel: "How you host & what you need on the day",
    riderPlaceholder:
      "One wireless handheld mic + a backup, a mic stand, soundcheck 30 min before doors. I need the final run-of-show in advance, a confidence monitor or printed sheet for names/timings, and an input to the sound desk for music and cues. Note your typical hosting block.",
    gigTypeHint: "Residency = recurring host gigs (a weekly quiz/bingo/karaoke night, a resident venue slot) — some of the steadiest work; one-off = weddings and single galas.",
  },
  COMEDIAN: {
    styleLabel: "Your style of comedy",
    stylePlaceholder: "clean / corporate, observational, improv, roast, storytelling, musical, host spots",
    styleHint: "Include your content rating — clean / family-friendly, PG-13, or club / adult — so we only pitch rooms that fit.",
    oneLinerPlaceholder: "Clean, quick and corporate-safe — the comic you can book without a nervous laugh from HR",
    bioPlaceholder:
      "What kind of laugh you bring and who you kill for: your style and content rating, the rooms you crush (corporate, clubs, weddings), credits, set lengths, and what makes your voice yours.",
    showcaseNote:
      "Tight live clips are everything — a sizzle reel or your best 3-5 minutes of real laughs with visible crowd reaction. For corporate work, a clean-set clip and a list of credits seal it.",
    socialPlaceholder: "https://instagram.com/you\nhttps://tiktok.com/@you\nhttps://youtube.com/@you",
    riderLabel: "How you perform & what you need",
    riderPlaceholder:
      "A working mic + stand, a backless stool, room-temp water, and a stage light so the crowd can see me. I do a 20-min feature, 30-45 headline, or up to an hour. My set is [clean / PG-13 / club] — let's agree the content rating up front.",
    gigTypeHint: "Residency = recurring club nights or a room you host monthly (steady gigs); one-off = corporate shows and private events.",
  },
  PHOTO_BOOTH: {
    styleLabel: "Your booth types",
    stylePlaceholder: "open-air, enclosed, 360, mirror, vintage glam",
    styleHint: "The booths you run, comma-separated — this is how venues and planners search for you.",
    oneLinerPlaceholder: "360 + open-air booths with instant prints, GIFs, and an attendant who keeps the line moving",
    bioPlaceholder:
      "The experience you bring: your booth types, instant prints / GIFs / texts, the attendant, custom backdrops and branded strips, and the prop kit — what makes your booth the centerpiece of the party.",
    showcaseNote:
      "Two kinds of media win here: photos of the booth looking sharp in a real venue, and sample outputs (printed strips, GIFs, 360 clips). A short reel of a packed booth with a live line is your strongest asset.",
    socialPlaceholder: "https://instagram.com/you\nhttps://tiktok.com/@you\nhttps://yoursite.com",
    riderLabel: "How you set up & what you need on site",
    riderPlaceholder:
      "Floor space (e.g. 8x8 ft open-air, 10x10 ft for 360), two dedicated power outlets within 15 ft, a 6 ft table with linen, wifi or strong signal for instant sharing, a spot out of direct sunlight. We arrive ~90 min early; setup ~30 min.",
    gigTypeHint: "Mostly one-off events (weddings, parties, corporate). Residency reframes as a recurring venue activation — a standing weekly/monthly booth night — keep it if you run those.",
  },
  OTHER: {
    styleLabel: "What you do",
    stylePlaceholder: "caricature artist, balloon artist, stilt walker, living statue, fire performer, face painter",
    styleHint: "Describe your act in a few plain tags, comma-separated — this is how venues and planners find you.",
    oneLinerPlaceholder: "Roaming caricature artist who turns the line for the bar into the best part of the night",
    bioPlaceholder:
      "The experience you bring that people don't expect: how you read a room or hold a crowd, how easy you are to work with, and how you shape the act to fit the event.",
    showcaseNote:
      "Because the act is unfamiliar until people see it, live video carries the most weight — short clips of you performing and the crowd reacting, plus a few photos of you in action at a real event.",
    socialPlaceholder: "https://instagram.com/you\nhttps://youtube.com/@you\nhttps://tiktok.com/@you",
    riderLabel: "How you perform & what you need on site",
    riderPlaceholder:
      "Your space, power and setup needs in your own words — e.g. a 6x6 ft area to perform (or free roam), one power outlet if you use sound/lights, a stool/table for seated work, and setup time. Note anything venue-specific (ceiling height for stilts, clearance for fire).",
    gigTypeHint: "Mostly one-off events. Residency still applies as a recurring slot (a regular roaming act at a venue's weekly night or brunch) — keep it if that's you.",
  },
};

// Local stroked-SVG check (mirrors pricing's CheckIcon) — replaces the "✓"
// glyph everywhere it was used as UI chrome (docs/DESIGN.md v2.1 rule 1: NO
// EMOJI IN UI). Inherits color via currentColor; size with className per spot.
/** Live license flags computed by the wizard shell from what's typed so far —
 *  mirrors the license-critical checks in lib/profile/strength.ts (the server
 *  truth that actually gates pitching). Shown, never enforced, here. */
export type LicenseFlags = {
  video: boolean;
  photos: boolean;
  photoCount: number;
  bio: boolean;
  headline: boolean;
  genres: boolean;
  city: boolean;
  floor: boolean;
  gig: boolean;
};

/**
 * The hunting license, made visible (audit 2026-07): bio/photos/video are
 * labelled "optional" by the form — true for finishing the wizard, false for
 * venue pitching. This meter says exactly what unlocks the Hunt so nobody
 * subscribes expecting pitches a locked license can't send.
 */
function LicenseMeter({ license }: { license: LicenseFlags }) {
  const items: { label: string; done: boolean }[] = [
    { label: "A performance video", done: license.video },
    {
      label: license.photos ? "3 photos" : `3 photos (${license.photoCount}/3)`,
      done: license.photos,
    },
    { label: "A short bio", done: license.bio },
    { label: "Your one-liner", done: license.headline },
    { label: "Your sound / style", done: license.genres },
    { label: "Home city", done: license.city },
    { label: "Your fee floor", done: license.floor },
    { label: "A gig on your calendar (step 4)", done: license.gig },
  ];
  const doneCount = items.filter((i) => i.done).length;
  return (
    <div className="rounded-2xl border border-cream bg-cream/20 p-4">
      <SectionLabel>
        Your hunting license — {doneCount}/{items.length}
      </SectionLabel>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-ink-stage/60">
        Everything else works without these — but the agent pitches venues in your name only once
        they&apos;re in place. A pitch without a face or a clip gets deleted, so it won&apos;t send a
        thin one for you.
      </p>
      <ul className="grid grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            {item.done ? (
              <CheckMark className="size-3.5 flex-none text-brand-cyan" />
            ) : (
              <span
                aria-hidden
                className="size-3 flex-none rounded-full border-[1.5px] border-ink-stage/30"
              />
            )}
            <span className={item.done ? "text-ink-stage/80" : "text-ink-stage/55"}>
              {item.label}
            </span>
            <span className="sr-only">{item.done ? "— done" : "— still to add"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CheckMark({ className = "" }: { className?: string }) {
  // Re-exported convenience: the shared glyph lives in components/ui.tsx.
  return <UiCheckMark className={className} />;
}

function StepHeading({ step, title, blurb }: { step: number; title: string; blurb: string }) {
  return (
    <header className="mb-5">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-stage/45">
        Step {step + 1} of {STEPS.length}
      </p>
      <h2 className="mt-1 text-xl font-extrabold tracking-tight text-ink-stage">{title}</h2>
      <p className="mt-1 text-sm text-ink-stage/60">{blurb}</p>
    </header>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    // Lives inside the white step card — ink-outline ghost (v2).
    <button type="button" onClick={onBack} className={buttonStyles.secondaryOnLight}>
      ← Back
    </button>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Your business
// ---------------------------------------------------------------------------

function StepBusiness({
  initial,
  onDone,
}: {
  initial: WizardBusiness;
  onDone: (country: string, performerKind: PerformerKind, homeCity: string) => void;
}) {
  const [kind, setKind] = useState<PerformerKind>(initial.performerKind);
  const [result, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prev, fd) => {
      const country = String(fd.get("country") ?? "");
      const homeCity = String(fd.get("homeCity") ?? "");
      const res = await saveBusinessBasics({
        name: String(fd.get("name") ?? ""),
        ownerName: String(fd.get("ownerName") ?? ""),
        performerKind: kind,
        country,
        homeCity,
        timezone: String(fd.get("timezone") ?? ""),
        websiteUrl: String(fd.get("websiteUrl") ?? ""),
      });
      // Hand the chosen country, craft AND home city up so step 2 can label
      // fees in the right currency, adapt its copy to the performer kind, and
      // keep the license meter honest — all without a page reload.
      if (res.ok) onDone(country || initial.country, kind, homeCity.trim() || initial.homeCity);
      return res;
    },
    null,
  );

  const timezones = useMemo(() => {
    const known =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"];
    return known.includes(initial.timezone) ? known : [initial.timezone, ...known];
  }, [initial.timezone]);

  // Group the ~400 zones by region (Asia, Europe, …) with city-only labels, so
  // the dropdown is scannable instead of one overwhelming flat list.
  const tzGroups = useMemo(() => {
    const groups: Record<string, { value: string; label: string }[]> = {};
    for (const z of timezones) {
      const slash = z.indexOf("/");
      const region = slash === -1 ? "Other" : z.slice(0, slash);
      const city = slash === -1 ? z : z.slice(slash + 1).replaceAll("_", " ").replaceAll("/", " — ");
      (groups[region] ??= []).push({ value: z, label: city });
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [timezones]);

  // Pre-select the visitor's ACTUAL timezone — the browser knows it — so a new
  // signup almost never has to open the list (a Bangkok user lands on
  // Asia/Bangkok, not America/New_York). useSyncExternalStore's server snapshot
  // is the saved value, so SSR markup never mismatches; the browser value only
  // takes over after hydration, and an explicit user choice always wins.
  const detectedTz = useSyncExternalStore(
    subscribeToNothing,
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    () => initial.timezone,
  );
  const [tzChoice, setTzChoice] = useState<string | null>(null);
  const tz =
    tzChoice ?? (detectedTz && timezones.includes(detectedTz) ? detectedTz : initial.timezone);

  // Keep an already-saved country selectable even if it's not in the list
  // (e.g. a legacy/excluded code on an existing business) so editing never
  // silently changes it.
  const countries = COUNTRIES.some((c) => c.code === initial.country)
    ? COUNTRIES
    : [{ code: initial.country, name: initial.country }, ...COUNTRIES];

  return (
    <form action={formAction} className="space-y-4">
      <StepHeading
        step={0}
        title="Your business"
        blurb="The basics — this is the name your clients see on every reply we draft for you."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ob-name" className={labelStyles}>Stage / artist name</label>
          <input
            id="ob-name"
            name="name"
            required
            defaultValue={initial.name}
            placeholder="DJ Midnight (or Midnight Groove)"
            className={inputStyles}
          />
          <p className="mt-1 text-xs text-ink-stage/50">The name clients and venues see — use what you perform under.</p>
        </div>
        <div>
          <label htmlFor="ob-owner" className={labelStyles}>Your name</label>
          <input
            id="ob-owner"
            name="ownerName"
            required
            defaultValue={initial.ownerName}
            placeholder="Sam Rivera"
            className={inputStyles}
          />
        </div>
      </div>

      <div>
        <span className={labelStyles}>What do you perform?</span>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {KINDS.map((k) => (
            <button
              type="button"
              key={k.kind}
              onClick={() => setKind(k.kind)}
              aria-pressed={kind === k.kind}
              className={`flex min-h-[3.25rem] items-center justify-center rounded-2xl border px-2 py-3 text-center text-xs font-semibold leading-tight transition-all ${
                kind === k.kind
                  ? "border-brand-cyan bg-brand-cyan-soft/60 text-ink-stage ring-2 ring-brand-cyan shadow-sm"
                  : "border-cream bg-white text-ink-stage/70 hover:-translate-y-0.5 hover:border-brand-cyan/40 hover:shadow-md"
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="ob-country" className={labelStyles}>Country</label>
          <select id="ob-country" name="country" defaultValue={initial.country} className={inputStyles}>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>{c.name}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-stage/50">Sets the right email rules for your region.</p>
        </div>
        <div>
          <label htmlFor="ob-tz" className={labelStyles}>Timezone</label>
          <select
            id="ob-tz"
            name="timezone"
            value={tz}
            onChange={(e) => setTzChoice(e.target.value)}
            className={inputStyles}
          >
            {tzGroups.map(([region, zones]) => (
              <optgroup key={region} label={region}>
                {zones.map((z) => (
                  <option key={z.value} value={z.value}>
                    {z.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-stage/50">
            We detected yours — change it only if it&apos;s wrong. So “are you free June 14th?” means
            your June 14th.
          </p>
        </div>
      </div>

      <div>
        <label htmlFor="ob-city" className={labelStyles}>Where are you based?</label>
        <input
          id="ob-city"
          name="homeCity"
          required
          defaultValue={initial.homeCity}
          placeholder="Bangkok · Manchester · Austin"
          className={inputStyles}
        />
        <p className="mt-1 text-xs text-ink-stage/50">
          Your home city — the first place the agent hunts for venues and gigs. You can add more
          cities (and travel plans) later in the Control room.
        </p>
      </div>

      <div>
        <label htmlFor="ob-site" className={labelStyles}>Website (optional)</label>
        <input
          id="ob-site"
          name="websiteUrl"
          type="text"
          inputMode="url"
          defaultValue={initial.websiteUrl ?? ""}
          placeholder="yoursite.com"
          className={inputStyles}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {result && !result.ok && <p className="text-sm text-red-600">{result.error}</p>}
        <button type="submit" disabled={pending} className={buttonStyles.primary}>
          {pending ? "Saving…" : "Next: who you are →"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Who you are (artist profile + work/pricing dials, June 2026 redesign)
// Replaced the package builder: capture WHO the artist is so the Hunt matches
// WIDER, not a narrow event-typed rate card. Fees in the artist's own currency
// (derived from step 1). Packages now live in /dashboard/packages for inbound.
// ---------------------------------------------------------------------------

const GIG_TYPE_OPTIONS = [
  { v: "one-off", label: "One-off gigs" },
  { v: "residency", label: "Residencies (regular slots)" },
] as const;

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink-stage/45">
      {children}
    </p>
  );
}

function StepProfile({
  profile,
  performerKind,
  currency,
  uploadsEnabled,
  license,
  onChange,
  onDone,
  onBack,
}: {
  profile: WizardProfile;
  performerKind: PerformerKind;
  currency: string;
  uploadsEnabled: boolean;
  license: LicenseFlags;
  onChange: Dispatch<SetStateAction<WizardProfile>>;
  onDone: () => void;
  onBack: () => void;
}) {
  const copy = PERFORMER_KIND_COPY[performerKind] ?? PERFORMER_KIND_COPY.OTHER;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof WizardProfile>(key: K, value: WizardProfile[K]) =>
    onChange((p) => ({ ...p, [key]: value }));

  // Functional updates so concurrent photo uploads never clobber each other.
  const addPhoto = (url: string) => onChange((p) => ({ ...p, photoUrls: [...p.photoUrls, url] }));
  const removePhoto = (url: string) =>
    onChange((p) => ({ ...p, photoUrls: p.photoUrls.filter((u) => u !== url) }));

  function toggleGigType(t: string) {
    onChange((p) => ({
      ...p,
      gigTypes: p.gigTypes.includes(t)
        ? p.gigTypes.filter((x) => x !== t)
        : [...p.gigTypes, t],
    }));
  }

  const doesResidency = profile.gigTypes.includes("residency");
  const canAdvance =
    profile.genres.trim().length > 0 &&
    profile.headline.trim().length > 0 &&
    profile.feeFloor.trim().length > 0;

  async function handleNext() {
    setError(null);
    setPending(true);
    try {
      const res = await saveArtistProfile({
        genres: profile.genres,
        headline: profile.headline,
        bio: profile.bio,
        videoLinks: profile.videoLinks,
        socialLinks: profile.socialLinks,
        photoUrls: profile.photoUrls,
        riderNotes: profile.riderNotes,
        gigTypes: profile.gigTypes,
        acceptsTravel: profile.acceptsTravel,
        feeFloor: profile.feeFloor,
        residencyRate: doesResidency ? profile.residencyRate : "",
      });
      if (!res.ok) return setError(res.error ?? "Could not save — try again");
      onDone();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-6">
      <StepHeading
        step={1}
        title="Who you are"
        blurb="This is what the agent pitches and replies with — the more it knows you, the better (and more often) it can win you the right rooms. The essentials take a minute; add the rest now or anytime."
      />

      {/* A — IDENTITY (the matching + press-kit basics) */}
      <div className="space-y-4">
        <div>
          <label htmlFor="ob-style" className={labelStyles}>{copy.styleLabel}</label>
          <input
            id="ob-style"
            value={profile.genres}
            onChange={(e) => set("genres", e.target.value)}
            placeholder={copy.stylePlaceholder}
            className={inputStyles}
          />
          <p className="mt-1 text-xs text-ink-stage/50">{copy.styleHint}</p>
        </div>

        <div>
          <label htmlFor="ob-headline" className={labelStyles}>Describe your act in one line</label>
          <input
            id="ob-headline"
            value={profile.headline}
            maxLength={80}
            onChange={(e) => set("headline", e.target.value)}
            placeholder={copy.oneLinerPlaceholder}
            className={inputStyles}
          />
          <p className="mt-1 text-xs text-ink-stage/50">
            The first line a venue reads. {Math.max(0, 80 - profile.headline.length)} characters left.
          </p>
        </div>

        <div>
          <label htmlFor="ob-bio" className={labelStyles}>
            Short bio{" "}
            <span className="font-normal normal-case text-ink-stage/40">(optional — but it lands more gigs)</span>
          </label>
          <textarea
            id="ob-bio"
            value={profile.bio}
            onChange={(e) => set("bio", e.target.value)}
            rows={3}
            placeholder={copy.bioPlaceholder}
            className={`${inputStyles} resize-y`}
          />
        </div>
      </div>

      {/* B — SHOWCASE (optional links; what wins bookings for THIS kind) */}
      <div className="space-y-4 rounded-2xl border border-cream bg-cream/20 p-4">
        <div>
          <SectionLabel>Show them what you do</SectionLabel>
          <p className="-mt-1 text-xs text-ink-stage/55">{copy.showcaseNote}</p>
        </div>
        {uploadsEnabled && (
          <div>
            <span className={labelStyles}>Photos</span>
            <PhotoUploader value={profile.photoUrls} onAdd={addPhoto} onRemove={removePhoto} />
            <p className="mt-1 text-xs text-ink-stage/50">
              A great action shot wins bookings — add a few, your best first.
            </p>
          </div>
        )}
        <div>
          <label htmlFor="ob-video" className={labelStyles}>Video links</label>
          <textarea
            id="ob-video"
            value={profile.videoLinks}
            onChange={(e) => set("videoLinks", e.target.value)}
            rows={2}
            placeholder={"https://youtube.com/watch?v=...\nhttps://vimeo.com/..."}
            className={`${inputStyles} font-mono text-xs leading-relaxed`}
          />
          <p className="mt-1 text-xs text-ink-stage/50">YouTube or Vimeo, one per line. The first one headlines your press kit.</p>
        </div>
        <div>
          <label htmlFor="ob-social" className={labelStyles}>Social &amp; streaming links</label>
          <textarea
            id="ob-social"
            value={profile.socialLinks}
            onChange={(e) => set("socialLinks", e.target.value)}
            rows={3}
            placeholder={copy.socialPlaceholder}
            className={`${inputStyles} font-mono text-xs leading-relaxed`}
          />
          <p className="mt-1 text-xs text-ink-stage/50">One link per line — they appear on your press kit page.</p>
        </div>
        <p className="text-xs text-ink-stage/45">
          {uploadsEnabled
            ? "Add or change any of this anytime from your profile."
            : "Photo uploads are coming — for now, link them above. Add or change any of this anytime from your profile."}
        </p>
      </div>

      {/* C — HOW YOU WORK (the dials + the rider) */}
      <div className="space-y-4 rounded-2xl border border-dashed border-ink-stage/20 bg-cream/30 p-4">
        <SectionLabel>How you work &amp; what you need</SectionLabel>
        <div>
          <span className={labelStyles}>What you take on</span>
          <div className="flex flex-wrap gap-2">
            {GIG_TYPE_OPTIONS.map((g) => (
              <button
                type="button"
                key={g.v}
                onClick={() => toggleGigType(g.v)}
                aria-pressed={profile.gigTypes.includes(g.v)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  profile.gigTypes.includes(g.v)
                    ? "bg-brand-cyan text-ink-stage"
                    : "border border-cream bg-white text-ink-stage/60 hover:border-brand-cyan/50"
                }`}
              >
                {g.label}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-ink-stage/50">{copy.gigTypeHint}</p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="ob-floor" className={labelStyles}>One-off floor ({currency})</label>
            <input
              id="ob-floor"
              inputMode="numeric"
              value={profile.feeFloor}
              onChange={(e) => set("feeFloor", e.target.value)}
              placeholder="1200"
              className={inputStyles}
            />
            <p className="mt-1 text-xs text-ink-stage/50">
              The lowest you&apos;ll take a one-off for. The agent never pitches below it.
            </p>
          </div>
          {doesResidency && (
            <div>
              <label htmlFor="ob-res" className={labelStyles}>Residency rate ({currency})</label>
              <input
                id="ob-res"
                inputMode="numeric"
                value={profile.residencyRate}
                onChange={(e) => set("residencyRate", e.target.value)}
                placeholder="800"
                className={inputStyles}
              />
              <p className="mt-1 text-xs text-ink-stage/50">Your going per-night rate for a regular slot.</p>
            </div>
          )}
        </div>

        <label className="flex items-center gap-2.5 text-sm text-ink-stage/80">
          <input
            type="checkbox"
            checked={profile.acceptsTravel}
            onChange={(e) => set("acceptsTravel", e.target.checked)}
            className="size-4 accent-brand-cyan"
          />
          I&apos;m open to travel beyond my home cities
        </label>

        <div>
          <label htmlFor="ob-rider" className={labelStyles}>
            {copy.riderLabel}{" "}
            <span className="font-normal normal-case text-ink-stage/40">(optional)</span>
          </label>
          <textarea
            id="ob-rider"
            value={profile.riderNotes}
            onChange={(e) => set("riderNotes", e.target.value)}
            rows={4}
            placeholder={copy.riderPlaceholder}
            className={`${inputStyles} resize-y`}
          />
          <p className="mt-1 text-xs text-ink-stage/50">
            The agent uses this to answer setup questions in your replies — and never makes one up.
          </p>
        </div>
      </div>

      <LicenseMeter license={license} />

      <div className="flex items-center justify-between gap-3 pt-1">
        <BackButton onBack={onBack} />
        <button
          type="button"
          onClick={handleNext}
          disabled={pending || !canAdvance}
          className={buttonStyles.primary}
        >
          {pending ? "Saving…" : "Next: your voice →"}
        </button>
      </div>
      {error && <p className="text-right text-xs text-red-600">{error}</p>}
      {!canAdvance && !error && (
        <p className="text-right text-xs text-ink-stage/50">
          Add your {copy.styleLabel.toLowerCase().replace(/[?]/g, "")}, a one-line description, and your one-off floor to continue.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Your voice
// ---------------------------------------------------------------------------

const SAMPLE_PLACEHOLDERS = [
  "Hi Sarah — congrats on the engagement! June 14th is wide open, I'd love to be part of your day…",
  "Hi Tom, thanks for thinking of me! I'm actually booked that Saturday, but here's what I'd suggest…",
  "Hi again Jess — just circling back on the 14th in case my note slipped through…",
];

function StepVoice({
  voice,
  onChange,
  onDone,
  onBack,
}: {
  voice: VoiceState;
  onChange: Dispatch<SetStateAction<VoiceState>>;
  onDone: () => void;
  onBack: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setSample = (i: number, val: string) =>
    onChange((v) => ({ ...v, samples: v.samples.map((s, idx) => (idx === i ? val : s)) }));
  const addSample = () =>
    onChange((v) => (v.samples.length >= 3 ? v : { ...v, samples: [...v.samples, ""] }));
  const removeSample = (i: number) =>
    onChange((v) => ({ ...v, samples: v.samples.filter((_, idx) => idx !== i) }));
  const toggleTone = (t: Tone) =>
    onChange((v) => ({
      ...v,
      tones: v.tones.includes(t) ? v.tones.filter((x) => x !== t) : [...v.tones, t],
    }));
  const setEmoji = (val: boolean) => onChange((v) => ({ ...v, emoji: v.emoji === val ? null : val }));

  async function handleNext() {
    setError(null);
    const joined = voice.samples.map((s) => s.trim()).filter(Boolean).join("\n\n———\n\n");
    setPending(true);
    try {
      const res = await saveVoiceSamples({
        samples: joined,
        tones: voice.tones,
        greeting: voice.greeting,
        signoff: voice.signoff,
        emoji: voice.emoji,
        phrases: voice.phrases,
      });
      if (!res.ok) return setError(res.error ?? "Could not save — try again");
      onDone();
    } finally {
      setPending(false);
    }
  }

  // "Skip for now": performers without old replies at hand were bouncing off
  // the 20-character sample wall — the top of the whole funnel. The default
  // voice keeps drafts neutral-professional; the strength meter nags for real
  // samples later. Tone chips and the quick-check answers still count.
  async function handleSkip() {
    setError(null);
    setPending(true);
    try {
      const res = await saveVoiceSamples({
        samples: "",
        skipped: true,
        tones: voice.tones,
        greeting: voice.greeting,
        signoff: voice.signoff,
        emoji: voice.emoji,
        phrases: voice.phrases,
      });
      if (!res.ok) return setError(res.error ?? "Could not save — try again");
      onDone();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <StepHeading
        step={2}
        title="Your voice"
        blurb="This is the secret sauce — paste a few real replies you've actually sent, then answer a couple of quick questions. We'll write every draft the way you would, so nobody can tell you didn't type it."
      />

      <div>
        <span className={labelStyles}>Replies you&apos;ve sent (the real ones, typos and all)</span>
        <p className="mb-2 mt-1 text-xs text-ink-stage/50">
          Two or three is the sweet spot — a quick yes, a follow-up, a tricky date. One per box; the more range, the more it sounds like you.
        </p>
        <div className="space-y-2">
          {voice.samples.map((s, i) => (
            <div key={i} className="relative">
              <textarea
                value={s}
                onChange={(e) => setSample(i, e.target.value)}
                rows={4}
                placeholder={SAMPLE_PLACEHOLDERS[i] ?? "Another reply you've sent…"}
                className={`${inputStyles} font-mono text-xs leading-relaxed`}
                aria-label={`Sample reply ${i + 1}`}
              />
              {voice.samples.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeSample(i)}
                  className="absolute right-2 top-2 rounded-md bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold text-ink-stage/45 hover:text-ink-stage"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
        {voice.samples.length < 3 && (
          <button
            type="button"
            onClick={addSample}
            className="mt-2 text-sm font-semibold text-brand-cyan hover:opacity-80"
          >
            + Add another reply
          </button>
        )}
      </div>

      <div>
        <span className={labelStyles}>And the vibe is… (pick any)</span>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => toggleTone(t)}
              aria-pressed={voice.tones.includes(t)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                voice.tones.includes(t)
                  ? "bg-brand-cyan text-ink-stage shadow-sm"
                  : "border border-cream bg-white text-ink-stage/60 hover:border-brand-cyan/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Quick voice check — explicit signals a single sample may not pin down. */}
      <div className="space-y-4 rounded-2xl border border-cream bg-cream/20 p-4">
        <SectionLabel>A few quick things (optional — they sharpen the match)</SectionLabel>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="ob-greeting" className={labelStyles}>How you open</label>
            <input
              id="ob-greeting"
              value={voice.greeting}
              onChange={(e) => onChange((v) => ({ ...v, greeting: e.target.value }))}
              placeholder="Hey [name]! / Hi [name],"
              className={inputStyles}
            />
          </div>
          <div>
            <label htmlFor="ob-signoff" className={labelStyles}>How you sign off</label>
            <input
              id="ob-signoff"
              value={voice.signoff}
              onChange={(e) => onChange((v) => ({ ...v, signoff: e.target.value }))}
              placeholder="Cheers, Sam / Talk soon —"
              className={inputStyles}
            />
          </div>
        </div>
        <div>
          <span className={labelStyles}>Emojis?</span>
          <div className="flex flex-wrap gap-2">
            {[{ v: false, label: "Never" }, { v: true, label: "Now & then" }].map((o) => (
              <button
                type="button"
                key={o.label}
                onClick={() => setEmoji(o.v)}
                aria-pressed={voice.emoji === o.v}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                  voice.emoji === o.v
                    ? "bg-brand-cyan text-ink-stage shadow-sm"
                    : "border border-cream bg-white text-ink-stage/60 hover:border-brand-cyan/50"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="ob-phrases" className={labelStyles}>Any words or phrases you lean on?</label>
          <input
            id="ob-phrases"
            value={voice.phrases}
            onChange={(e) => onChange((v) => ({ ...v, phrases: e.target.value }))}
            placeholder="let's lock it in, stoked, no worries"
            className={inputStyles}
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <BackButton onBack={onBack} />
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={handleSkip}
            disabled={pending}
            className="text-sm font-semibold text-ink-stage/45 underline-offset-2 hover:text-ink-stage/70 hover:underline"
          >
            Skip for now
          </button>
          <button type="button" onClick={handleNext} disabled={pending} className={buttonStyles.primary}>
            {pending ? "Saving…" : "Next: your calendar →"}
          </button>
        </div>
      </div>
      <p className="text-right text-xs text-ink-stage/40">
        No old replies at hand? Skip — drafts start in a clean professional tone, and you can paste
        real ones any time in the Control room.
      </p>
      {error && <p className="text-right text-xs text-red-600">{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Your calendar (skippable)
// ---------------------------------------------------------------------------

type GigRow = { date: string; title: string };

function StepCalendar({
  rows,
  setRows,
  savedCount,
  onSaved,
  onDone,
  onBack,
}: {
  rows: GigRow[];
  setRows: (rows: GigRow[]) => void;
  savedCount: number;
  onSaved: (added: number) => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Residency logger — a recurring weekly slot expanded into booked nights.
  const [res, setRes] = useState({
    weekday: null as number | null,
    title: "",
    from: isoToday(),
    to: isoToday(3),
    startTime: "",
    endTime: "",
  });
  const [resPending, setResPending] = useState(false);
  const [resNote, setResNote] = useState<{ ok: boolean; text: string } | null>(null);

  function updateRow(i: number, patch: Partial<GigRow>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function addResidencyNights() {
    setResNote(null);
    if (res.weekday === null) return setResNote({ ok: false, text: "Pick the day of the week." });
    if (!res.title.trim()) return setResNote({ ok: false, text: "Add the venue or a name." });
    if (!res.from || !res.to) return setResNote({ ok: false, text: "Pick a start and end date." });
    setResPending(true);
    try {
      const r = await addResidency({
        weekday: res.weekday,
        title: res.title.trim(),
        from: res.from,
        to: res.to,
        startTime: res.startTime,
        endTime: res.endTime,
      });
      if (!r.ok) return setResNote({ ok: false, text: r.error });
      onSaved(r.added); // bump the "N dates saved" banner
      const day = WEEKDAYS.find((d) => d.value === res.weekday)?.label ?? "";
      const when = res.startTime ? ` ${res.startTime}${res.endTime ? `–${res.endTime}` : ""}` : "";
      setResNote({
        ok: true,
        text: `Added ${r.added} ${day} night${r.added === 1 ? "" : "s"}${when} — ${res.title.trim()}.`,
      });
      setRes((prev) => ({ ...prev, weekday: null, title: "" })); // ready for the next residency; keep dates+time
    } finally {
      setResPending(false);
    }
  }

  async function handleNext() {
    setError(null);
    // Rows with a date count; empty titles become "Booked". Fully empty rows are ignored.
    const filled = rows
      .filter((r) => r.date !== "")
      .map((r) => ({ date: r.date, title: r.title.trim() || "Booked" }));
    if (rows.some((r) => r.date === "" && r.title.trim() !== "")) {
      return setError("One row has a title but no date — pick the date or clear it.");
    }
    if (filled.length === 0) return onDone(); // nothing entered = same as skipping

    setPending(true);
    try {
      const res = await addBookedDates(filled);
      if (!res.ok) return setError(res.error);
      onSaved(res.added);
      onDone();
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <StepHeading
        step={3}
        title="Your calendar"
        blurb="Drop in the dates you're already booked so we never tell a couple you're free when you're not. Rough titles are fine."
      />

      {savedCount > 0 && (
        <p className="flex items-center gap-2 rounded-2xl bg-brand-cyan-soft/60 px-4 py-2 text-sm font-medium text-ink-stage">
          <CheckMark className="size-4 flex-none text-brand-cyan" />
          {savedCount} {savedCount === 1 ? "date" : "dates"} already saved to your calendar
        </p>
      )}

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="date"
              value={row.date}
              onChange={(e) => updateRow(i, { date: e.target.value })}
              className={`${inputStyles} sm:w-40 sm:flex-none`}
              aria-label={`Booked date ${i + 1}`}
            />
            <input
              value={row.title}
              onChange={(e) => updateRow(i, { title: e.target.value })}
              placeholder="Nguyen wedding"
              className={inputStyles}
              aria-label={`Title for booked date ${i + 1}`}
            />
            {/* Remove only shows once a row has content — an empty default row
                has nothing to remove, so the control would just read as a
                confusing dot. Kept in the layout (invisible) so nothing shifts. */}
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
              aria-label={`Remove booked date ${i + 1}`}
              className={`flex-none rounded-lg px-2 py-1.5 text-lg leading-none text-ink-stage/35 transition-colors hover:bg-red-50 hover:text-red-600 ${
                row.date || row.title.trim() ? "" : "invisible"
              }`}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setRows([...rows, { date: "", title: "" }])}
        className={`${buttonStyles.secondaryOnLight} w-full border-dashed`}
      >
        + Add another date
      </button>

      {/* Residency — log a recurring weekly slot once; we expand every night. */}
      <div className="space-y-3 rounded-2xl border border-dashed border-ink-stage/20 bg-cream/30 p-4">
        <div>
          <SectionLabel>Got a residency? Log it once</SectionLabel>
          <p className="-mt-1 text-xs text-ink-stage/55">
            Playing a regular weekly slot? Pick the day and the run of dates — we&apos;ll block every one, so
            you&apos;re never shown as free that night. Add each residency separately (e.g. Wednesdays at one
            venue, Fridays at another).
          </p>
        </div>
        <div>
          <span className={labelStyles}>Which day?</span>
          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((d) => (
              <button
                type="button"
                key={d.value}
                onClick={() => setRes((p) => ({ ...p, weekday: d.value }))}
                aria-pressed={res.weekday === d.value}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                  res.weekday === d.value
                    ? "bg-brand-cyan text-ink-stage"
                    : "border border-cream bg-white text-ink-stage/60 hover:border-brand-cyan/50"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label htmlFor="res-title" className={labelStyles}>Venue / name</label>
          <input
            id="res-title"
            value={res.title}
            onChange={(e) => setRes((p) => ({ ...p, title: e.target.value }))}
            placeholder="Sing Sing (Wed residency)"
            className={inputStyles}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="res-from" className={labelStyles}>From</label>
            <input
              id="res-from"
              type="date"
              value={res.from}
              onChange={(e) => setRes((p) => ({ ...p, from: e.target.value }))}
              className={inputStyles}
            />
          </div>
          <div>
            <label htmlFor="res-to" className={labelStyles}>Until</label>
            <input
              id="res-to"
              type="date"
              value={res.to}
              onChange={(e) => setRes((p) => ({ ...p, to: e.target.value }))}
              className={inputStyles}
            />
          </div>
        </div>
        <div>
          <span className={labelStyles}>
            Time <span className="font-normal normal-case text-ink-stage/40">(optional — keeps you free around the slot)</span>
          </span>
          <div className="grid grid-cols-2 gap-3">
            <input
              type="time"
              aria-label="Residency start time"
              value={res.startTime}
              onChange={(e) => setRes((p) => ({ ...p, startTime: e.target.value }))}
              className={inputStyles}
            />
            <input
              type="time"
              aria-label="Residency end time"
              value={res.endTime}
              onChange={(e) => setRes((p) => ({ ...p, endTime: e.target.value }))}
              className={inputStyles}
            />
          </div>
          <p className="mt-1 text-xs text-ink-stage/50">
            Add a time (e.g. 7:00pm–9:00pm) and we&apos;ll only block that window — so a late gig elsewhere that night still counts you as free. Leave blank to block the whole day.
          </p>
        </div>
        <button
          type="button"
          onClick={addResidencyNights}
          disabled={resPending}
          className={`${buttonStyles.secondaryOnLight} w-full`}
        >
          {resPending ? "Adding…" : "Add residency nights"}
        </button>
        {resNote && (
          <p className={`text-xs ${resNote.ok ? "font-semibold text-brand-cyan" : "text-red-600"}`}>
            {resNote.text}
          </p>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-between gap-3 pt-2">
        <BackButton onBack={onBack} />
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onDone}
            className="text-sm text-ink-stage/50 underline decoration-dotted underline-offset-4 hover:text-brand-cyan transition-colors"
          >
            I’ll do this later
          </button>
          <button type="button" onClick={handleNext} disabled={pending} className={buttonStyles.primary}>
            {pending ? "Saving…" : "Next: connect your leads →"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 5 — Connect your leads (walkthroughs + live verifier)
// ---------------------------------------------------------------------------

function Walkthrough({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-cream bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 text-sm font-semibold text-ink-stage [&::-webkit-details-marker]:hidden">
        {/* cyan square anchor — the Kicker system's prefix (v2.1 rule 2), no emoji */}
        <span aria-hidden className="size-1.5 flex-none bg-brand-cyan" />
        {title}
        <span aria-hidden className="ml-auto text-ink-stage/40 transition-transform group-open:rotate-90">
          ›
        </span>
      </summary>
      <div className="border-t border-cream px-4 py-3 text-sm leading-relaxed text-ink-stage/75">
        {children}
      </div>
    </details>
  );
}

/** The assistant's address, shown ONLY inside the actions that need it —
 *  it's plumbing, not a hero (founder feedback: a big unexplained address
 *  reads as something the artist must figure out). */
function LeadAddressPill({ address }: { address: string }) {
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <code className="select-all break-all rounded-full border border-cream bg-cream/40 px-3.5 py-1.5 font-mono text-[13px] font-semibold text-ink-stage">
        {address}
      </code>
      <CopyButton text={address} />
    </div>
  );
}

function StepConnect({
  leadAddress,
  leadDetected,
  tookTooLong,
  licenseReady,
  forwardingConfirm,
  chosenPlan,
  onBack,
}: {
  leadAddress: string;
  leadDetected: boolean;
  /** ~90s elapsed on this step with no lead detected (audit C2 fallback). */
  tookTooLong: boolean;
  /** Hunting license complete (client-side view) — gates the finale's promise. */
  licenseReady: boolean;
  /** Gmail's forwarding-approval link/code, once its verification email landed. */
  forwardingConfirm: { url: string | null; code: string | null } | null;
  /** Plan picked on the pricing page — the finale opens checkout for it. */
  chosenPlan: "STARTER" | "PRO" | "STUDIO" | null;
  onBack: () => void;
}) {
  const [provider, setProvider] = useState<"gmail" | "outlook">("gmail");
  const [checkoutPending, setCheckoutPending] = useState(false);

  return (
    <div className="space-y-4">
      <StepHeading
        step={4}
        title="Point your inquiries here"
        blurb="A client emails you like always. Your inbox slips a copy to your assistant, a reply drafts itself in your voice, and you approve it from your phone. Set it up once — or try it by hand right now."
      />

      {/* The mental model, in three plain steps — this is what makes the page
          make sense to a non-technical artist. */}
      <div className="rounded-2xl bg-cream/40 p-4">
        <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-stage/55">
          How it works
        </p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-stage/75">
          <li>A client emails you — nothing changes for them.</li>
          <li>
            A copy of that email reaches your assistant (you forward it, or a one-time rule does it
            for you).
          </li>
          <li>
            It drafts the reply in your voice → you approve → it sends as your business. The
            client&apos;s answer lands back in your normal inbox, and every inquiry shows up in your
            Pipeline here.
          </li>
        </ol>
        <p className="mt-2.5 text-xs leading-relaxed text-ink-stage/55">
          Clients and venues never see your assistant&apos;s address — it&apos;s internal, only your
          inbox uses it. Venue outreach is separate: those emails go out from your own Gmail once you
          connect it in your Control Room.
        </p>
      </div>

      {/* Gmail's forwarding approval — the one click self-serve activation used
          to dead-end on (the pipeline now catches the verification email the
          moment it arrives; the poll surfaces it here live). */}
      {forwardingConfirm && (
        <div className="rounded-2xl border-2 border-brand-cyan bg-white p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <StickerChip tone="ink" rotate={-2}>
              Gmail confirmation caught
            </StickerChip>
          </div>
          <p className="mt-3 font-bold text-ink-stage">One click left — approve the forwarding</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-stage/70">
            Gmail sent its verification to your assistant and we caught it. Approve it and every
            inquiry flows in on its own. Already clicked it? You&apos;re done — send yourself a test
            below.
          </p>
          {forwardingConfirm.url ? (
            <a
              href={forwardingConfirm.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`mt-3 inline-block ${buttonStyles.primary} text-sm`}
            >
              Approve forwarding in Gmail →
            </a>
          ) : (
            <p className="mt-3 text-sm text-ink-stage/70">
              Open the &quot;Gmail Forwarding Confirmation&quot; email Gmail also sent to your own
              inbox and click its link.
            </p>
          )}
          {forwardingConfirm.code && (
            <p className="mt-3 text-sm text-ink-stage/70">
              Or paste this code into Gmail&apos;s forwarding settings:{" "}
              <span className="rounded-md bg-cream/60 px-2 py-0.5 font-mono text-xs font-bold text-ink-stage">
                {forwardingConfirm.code}
              </span>
            </p>
          )}
        </div>
      )}

      {/* Primary action + live proof (or the celebration once a lead lands).
          The address lives HERE, at the moment it's needed. */}
      {leadDetected ? (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-neon-magenta to-neon-orange p-8 text-center shadow-[0_16px_44px_rgba(255,45,174,0.35)]">
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <StickerChip tone="cream" rotate={-4}>
              First inquiry caught
            </StickerChip>
            <StickerChip tone="ink" rotate={3}>
              Now playing — your reply
            </StickerChip>
          </div>
          <p className="mt-4 text-xl font-extrabold tracking-tight text-ink-stage">
            Your first inquiry just landed — it works.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-stage/75">
            {licenseReady ? (
              <>
                We caught it and read it. Your assistant is set up and ready to reply in your voice
                and hunt venues for you — choose a plan to switch it on, and it goes to work on this
                one and every one after.
              </>
            ) : (
              <>
                We caught it and read it. Choose a plan and your assistant answers this inquiry — and
                every one after — in your voice. Venue pitching unlocks once your hunting license is
                complete (the checklist on the “Who you are” step: video, photos, a calendar gig).
              </>
            )}
          </p>
          {chosenPlan ? (
            // They already chose on the pricing page — open checkout for that
            // plan directly; no re-deciding at the activation moment (P5.5).
            <button
              type="button"
              disabled={checkoutPending}
              onClick={() => {
                setCheckoutPending(true);
                void startCheckout(chosenPlan).catch(() => setCheckoutPending(false));
              }}
              className="mt-5 inline-block rounded-full bg-ink-stage px-5 py-2.5 font-bold text-cream-bright hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {checkoutPending
                ? "Opening checkout…"
                : `Activate ${chosenPlan.charAt(0) + chosenPlan.slice(1).toLowerCase()} →`}
            </button>
          ) : (
            <Link
              href="/dashboard/settings#billing"
              className="mt-5 inline-block rounded-full bg-ink-stage px-5 py-2.5 font-bold text-cream-bright hover:opacity-90 transition-opacity"
            >
              Choose your plan →
            </Link>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-brand-cyan/60 bg-white p-5">
          <p className="font-bold text-ink-stage">Try it now — forward one inquiry</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-stage/70">
            Grab any inquiry sitting in your email — or send a quick test from your phone — and
            forward it to your assistant:
          </p>
          <div className="mt-3">
            <LeadAddressPill address={leadAddress} />
          </div>
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-ink-stage/65">
            <span className="inline-block size-2 animate-pulse rounded-full bg-brand-cyan" aria-hidden />
            Listening for your first inquiry… (we check every 5 seconds)
          </p>
          {tookTooLong && (
            <p className="mt-3 rounded-xl bg-cream/60 px-3 py-2 text-sm text-ink-stage/70">
              Taking longer than expected? Make sure you forwarded to the exact address above — or skip
              this and we&apos;ll catch your first inquiry whenever it arrives.
            </p>
          )}
        </div>
      )}

      {/* Everything provider-specific is optional + tucked away (progressive
          disclosure) so the step reads as one idea + one action. */}
      <div className="space-y-2">
        <Walkthrough title="Make it automatic (optional)">
          <p className="mb-3">
            Set a one-time rule so every inquiry forwards itself and you never touch it again — the
            originals still land in your normal inbox. You&apos;ll paste this address:
          </p>
          <div className="mb-3">
            <LeadAddressPill address={leadAddress} />
          </div>
          <div className="mb-3 inline-flex rounded-full border border-cream bg-white p-0.5">
            {(["gmail", "outlook"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setProvider(p)}
                className={`rounded-full px-3.5 py-1 text-xs font-semibold transition-colors ${
                  provider === p ? "bg-brand-cyan text-ink-stage" : "text-ink-stage/55 hover:text-ink-stage"
                }`}
              >
                {p === "gmail" ? "Gmail" : "Outlook"}
              </button>
            ))}
          </div>
          {provider === "gmail" ? (
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Gmail → the gear (Settings) → <strong>See all settings</strong> →{" "}
                <strong>Forwarding and POP/IMAP</strong>.
              </li>
              <li>
                <strong>Add a forwarding address</strong> → paste the address above. Gmail sends a
                confirmation — we catch it, and an <strong>approval card appears right here</strong>{" "}
                within a minute. Click its link.
              </li>
              <li>
                Choose <strong>“Forward a copy of incoming mail to”</strong> your address → keep
                Gmail’s copy in the Inbox → <strong>Save</strong>. Done — every inquiry now arrives on
                its own.
              </li>
            </ol>
          ) : (
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>
                Outlook on the web → the gear (Settings) → <strong>Mail</strong> → <strong>Rules</strong> →{" "}
                <strong>Add new rule</strong>.
              </li>
              <li>Name it “Bright Ears”; condition <strong>Apply to all messages</strong>.</li>
              <li>
                Action: <strong>Forward to</strong> → paste the address above → <strong>Save</strong>.
                No confirmation step — it starts immediately.
              </li>
            </ol>
          )}
        </Walkthrough>

        <Walkthrough title="Getting inquiries from somewhere else?">
          <p>
            The Knot, WeddingWire, your website’s contact form — they all <strong>email you</strong>{" "}
            when a new inquiry comes in, so a forward (or the automatic rule above) catches them with
            nothing extra to set up.
          </p>
          <p className="mt-2 mb-2">
            <strong>Power move:</strong> paste your assistant’s address straight into your website
            form’s notification settings so those inquiries arrive on their own too:
          </p>
          <LeadAddressPill address={leadAddress} />
        </Walkthrough>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <BackButton onBack={onBack} />
        {!leadDetected && (
          <Link
            href="/dashboard"
            className="text-sm text-ink-stage/50 underline decoration-dotted underline-offset-4 hover:text-brand-cyan transition-colors"
          >
            I’ll set this up later — take me to my dashboard
          </Link>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// The wizard shell
// ---------------------------------------------------------------------------

export function OnboardingWizard({
  initialStep,
  business,
  initialProfile,
  uploadsEnabled,
  chosenPlan = null,
}: {
  initialStep: number;
  business: WizardBusiness;
  initialProfile: WizardProfile;
  uploadsEnabled: boolean;
  /** Plan picked on the pricing page — the finale opens checkout for it (P5.5). */
  chosenPlan?: "STARTER" | "PRO" | "STUDIO" | null;
}) {
  const [step, setStep] = useState(() =>
    Math.min(Math.max(initialStep, 0), STEPS.length - 1),
  );
  const [profile, setProfile] = useState<WizardProfile>(initialProfile);
  // Step 1 derives the fee currency from the chosen country (THB for Thailand)
  // and the craft drives step 2's adaptive copy; both tracked here so step 2 is
  // right even when changed mid-session, without a page reload.
  const [country, setCountry] = useState(business.country);
  const currency = currencyForCountry(country);
  const [performerKind, setPerformerKind] = useState<PerformerKind>(business.performerKind);
  const [voice, setVoice] = useState<VoiceState>(() => ({
    // Resume puts the existing samples in the first box; a fresh start shows two
    // empty boxes so "more than one" is obvious.
    samples: business.voiceSamples ? [stripToneNote(business.voiceSamples)] : ["", ""],
    tones: [],
    greeting: business.voiceGreeting ?? "",
    signoff: business.voiceSignoff ?? "",
    emoji: business.voiceUsesEmoji ?? null,
    phrases: business.voicePhrases ?? "",
  }));
  const [gigRows, setGigRows] = useState<GigRow[]>([
    { date: "", title: "" },
    { date: "", title: "" },
    { date: "", title: "" },
  ]);
  const [gigsSaved, setGigsSaved] = useState(0);
  const [homeCity, setHomeCity] = useState(business.homeCity);
  const [leadDetected, setLeadDetected] = useState(false);
  // Gmail's forwarding-approval link, once its verification email hits the
  // pipeline (intercepted + stored server-side; surfaced by the verify poll).
  const [forwardingConfirm, setForwardingConfirm] = useState<{
    url: string | null;
    code: string | null;
  } | null>(null);
  // After ~90s of polling on step 5 with no lead detected, surface a calm
  // fallback (audit C2) so the spinner doesn't appear to hang forever. The live
  // verifier keeps running underneath and still flips to success if a lead lands.
  const [tookTooLong, setTookTooLong] = useState(false);

  const leadAddress = `leads@${business.slug}.in.brightears.io`;

  // The hunting license, computed live from what's typed so far — the display
  // twin of lib/profile/strength.ts (server truth). Drives the step-2 meter
  // and the honest step-5 finale.
  const license: LicenseFlags = {
    video: profile.videoLinks.trim().length > 0,
    photos: profile.photoUrls.length >= 3,
    photoCount: profile.photoUrls.length,
    bio: profile.bio.trim().length > 0,
    headline: profile.headline.trim().length > 0,
    genres: profile.genres.trim().length > 0,
    city: homeCity.trim().length > 0,
    floor: profile.feeFloor.trim().length > 0,
    gig: gigsSaved > 0,
  };
  const licenseReady = Object.entries(license).every(
    ([key, value]) => key === "photoCount" || value === true,
  );

  function goTo(next: number) {
    setStep(Math.min(Math.max(next, 0), STEPS.length - 1));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Live verifier: while step 5 is open, poll for a Lead created in the last
  // 10 minutes (any email to the lead address becomes one).
  useEffect(() => {
    if (step !== 4 || leadDetected) return;
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/onboarding/verify", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as {
          verified: boolean;
          forwardingConfirmation?: { url: string | null; code: string | null } | null;
        };
        if (cancelled) return;
        if (data.forwardingConfirmation) setForwardingConfirm(data.forwardingConfirmation);
        if (data.verified) setLeadDetected(true);
      } catch {
        // Network blip — the next poll will catch it.
      }
    }

    check();
    const id = setInterval(check, 5_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [step, leadDetected]);

  // Calm fallback after ~90s on step 5 without a detected lead (audit C2). The
  // poll above keeps running and still flips to success if a lead arrives; this
  // only adds a "taking longer than expected" hint, it never stops listening.
  // The flag is reset in cleanup (never synchronously in the effect body) so
  // leaving the step or detecting a lead clears any stale hint.
  useEffect(() => {
    if (step !== 4 || leadDetected) return;
    const id = setTimeout(() => setTookTooLong(true), 90_000);
    return () => {
      clearTimeout(id);
      setTookTooLong(false);
    };
  }, [step, leadDetected]);

  return (
    // White step cards float on the ink canvas with the faint concentric rings
    // (docs/DESIGN.md — at most ONE ring pattern per page).
    <div className="relative flex-1 overflow-hidden bg-ink-stage">
      <RingsBackdrop />
      <main className="relative mx-auto w-full max-w-2xl px-6 py-10">
        <header className="mb-8 text-center">
          <div className="mb-3 flex justify-center">
            <BrightEarsLogo size={56} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-cream-bright">
            Let’s get you{" "}
            <span className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent">
              set up
            </span>
          </h1>
          <p className="mt-1 text-sm text-cream/60">
            Five quick steps — under ten minutes — and your assistant is ready to hunt venues and
            answer every inquiry in your voice. Choose a plan to switch it on; cancel anytime.
          </p>
        </header>

        <ol className="mb-8 flex flex-wrap items-center justify-center gap-2">
          {STEPS.map((s, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={() => done && goTo(i)}
                  disabled={!done && !current}
                  aria-current={current ? "step" : undefined}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
                    current
                      ? `${s.chip} shadow-md ring-2 ring-cream/60 ring-offset-2 ring-offset-ink-stage`
                      : done
                        ? `${s.chip} opacity-80 hover:opacity-100`
                        : "border-[1.5px] border-cream/25 bg-cream/5 text-cream/65"
                  }`}
                >
                  {/* Step number, or a stroked-SVG check once done — no emoji (v2.1 LAW). */}
                  {done ? (
                    <CheckMark className="size-3.5 flex-none" />
                  ) : (
                    <span aria-hidden className="font-mono font-bold">
                      {i + 1}
                    </span>
                  )}
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sr-only sm:hidden">{s.label}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <Card className="p-6 sm:p-8">
          {step === 0 && (
            <StepBusiness
              initial={business}
              onDone={(c, k, city) => {
                setCountry(c);
                setPerformerKind(k);
                setHomeCity(city);
                goTo(1);
              }}
            />
          )}
          {step === 1 && (
            <StepProfile
              profile={profile}
              performerKind={performerKind}
              currency={currency}
              uploadsEnabled={uploadsEnabled}
              license={license}
              onChange={setProfile}
              onDone={() => goTo(2)}
              onBack={() => goTo(0)}
            />
          )}
          {step === 2 && (
            <StepVoice
              voice={voice}
              onChange={setVoice}
              onDone={() => goTo(3)}
              onBack={() => goTo(1)}
            />
          )}
          {step === 3 && (
            <StepCalendar
              rows={gigRows}
              setRows={setGigRows}
              savedCount={gigsSaved}
              onSaved={(added) => {
                setGigsSaved((n) => n + added);
                setGigRows([{ date: "", title: "" }]);
              }}
              onDone={() => goTo(4)}
              onBack={() => goTo(2)}
            />
          )}
          {step === 4 && (
            <StepConnect
              leadAddress={leadAddress}
              leadDetected={leadDetected}
              tookTooLong={tookTooLong}
              licenseReady={licenseReady}
              forwardingConfirm={forwardingConfirm}
              chosenPlan={chosenPlan}
              onBack={() => goTo(3)}
            />
          )}
        </Card>
      </main>
    </div>
  );
}
