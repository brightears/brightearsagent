"use client";

// The 5-step onboarding wizard (/onboarding) — every new trial walks through
// this once. Design brief: bright, colorful, fun (CLAUDE.md), under 10 minutes.
// State lives client-side; each step persists via server actions on "Next":
//   1 Your business   → saveBusinessBasics (app/actions/onboarding.ts)
//   2 What you sell   → createPackage (app/actions/packages.ts, reused)
//   3 Your voice      → saveVoiceSamples
//   4 Your calendar   → addBookedDates (skippable)
//   5 Connect leads   → walkthroughs + live verifier polling /api/onboarding/verify

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  addBookedDates,
  saveArtistProfile,
  saveBusinessBasics,
  saveVoiceSamples,
} from "@/app/actions/onboarding";
import { buttonStyles, BrightEarsLogo, Card } from "@/components/ui";
import { RingsBackdrop, StickerChip } from "@/components/collage";
import { CopyButton } from "@/components/settings-form";
import { COUNTRIES, currencyForCountry } from "@/lib/geo/countries";
import { stripToneNote } from "@/lib/voice/tone-note";
import type { PerformerKind } from "@/app/generated/prisma/enums";

type ActionResult = { ok: boolean; error?: string } | null;

// Form styling per docs/DESIGN.md v2 — cream-tinted inputs on white cards, cyan focus ring.
const inputStyles =
  "w-full rounded-xl border border-cream bg-cream/40 px-3 py-2 text-sm text-ink-stage placeholder:text-ink-stage/35 focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 transition-colors";
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

// ---------------------------------------------------------------------------
// Props + shared bits
// ---------------------------------------------------------------------------

export interface WizardBusiness {
  slug: string;
  name: string;
  ownerName: string;
  performerKind: PerformerKind;
  country: string;
  timezone: string;
  websiteUrl: string | null;
  voiceSamples: string | null;
}

// Step 2 state — WHO the artist is + the work/pricing dials (replaced packages,
// June 2026). Fees are whole-currency strings for the inputs; the action
// converts to cents. Currency is derived from the step-1 country, not stored here.
export interface WizardProfile {
  genres: string; // comma-separated tags
  headline: string; // the one-line "vibe" descriptor
  bio: string;
  gigTypes: string[]; // "one-off" / "residency"
  acceptsTravel: boolean;
  feeFloor: string; // whole currency units (one-off floor)
  residencyRate: string; // whole currency units (per-night residency rate)
}

// Local stroked-SVG check (mirrors pricing's CheckIcon) — replaces the "✓"
// glyph everywhere it was used as UI chrome (docs/DESIGN.md v2.1 rule 1: NO
// EMOJI IN UI). Inherits color via currentColor; size with className per spot.
function CheckMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M5 10.5l3.5 3.5L15 6.5"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
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
  onDone: (country: string) => void;
}) {
  const [kind, setKind] = useState<PerformerKind>(initial.performerKind);
  const [result, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prev, fd) => {
      const country = String(fd.get("country") ?? "");
      const res = await saveBusinessBasics({
        name: String(fd.get("name") ?? ""),
        ownerName: String(fd.get("ownerName") ?? ""),
        performerKind: kind,
        country,
        timezone: String(fd.get("timezone") ?? ""),
        websiteUrl: String(fd.get("websiteUrl") ?? ""),
      });
      // Hand the chosen country up so step 2 can label fees in the right
      // currency immediately (THB for Thailand), without a page reload.
      if (res.ok) onDone(country || initial.country);
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
  // Asia/Bangkok, not America/New_York). Set after mount so the SSR'd default
  // doesn't cause a hydration mismatch.
  const [tz, setTz] = useState(initial.timezone);
  useEffect(() => {
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (detected && timezones.includes(detected)) setTz(detected);
  }, [timezones]);

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
          <label htmlFor="ob-name" className={labelStyles}>Business name</label>
          <input
            id="ob-name"
            name="name"
            required
            defaultValue={initial.name}
            placeholder="Midnight Groove Entertainment"
            className={inputStyles}
          />
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
            onChange={(e) => setTz(e.target.value)}
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

function StepProfile({
  profile,
  currency,
  onChange,
  onDone,
  onBack,
}: {
  profile: WizardProfile;
  currency: string;
  onChange: (p: WizardProfile) => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof WizardProfile>(key: K, value: WizardProfile[K]) =>
    onChange({ ...profile, [key]: value });

  function toggleGigType(t: string) {
    onChange({
      ...profile,
      gigTypes: profile.gigTypes.includes(t)
        ? profile.gigTypes.filter((x) => x !== t)
        : [...profile.gigTypes, t],
    });
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
    <div className="space-y-5">
      <StepHeading
        step={1}
        title="Who you are"
        blurb="This is what the agent pitches with — the richer your profile, the more (and better) venues it matches you to. No rigid event packages: just your craft, your sound, and how you work."
      />

      <div>
        <label htmlFor="ob-genres" className={labelStyles}>Your sound / style</label>
        <input
          id="ob-genres"
          value={profile.genres}
          onChange={(e) => set("genres", e.target.value)}
          placeholder="open format, house, disco, funk"
          className={inputStyles}
        />
        <p className="mt-1 text-xs text-ink-stage/50">
          Comma-separated. This is how the agent matches you — go broad; it never narrows your search.
        </p>
      </div>

      <div>
        <label htmlFor="ob-headline" className={labelStyles}>Describe your act in one line</label>
        <input
          id="ob-headline"
          value={profile.headline}
          maxLength={80}
          onChange={(e) => set("headline", e.target.value)}
          placeholder="Open-format DJ that keeps dance floors full"
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
          placeholder="A sentence or two in your own voice — who you are, where you've played, what a crowd gets when you're on."
          className={`${inputStyles} resize-y`}
        />
      </div>

      <div className="space-y-4 rounded-2xl border border-dashed border-ink-stage/20 bg-cream/30 p-4">
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
          <p className="mt-1 text-xs text-ink-stage/50">
            Most artists do both — a one-off and a regular slot price differently, so we ask for each.
          </p>
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
      </div>

      <p className="rounded-2xl bg-cream/50 px-4 py-3 text-xs text-ink-stage/55">
        Photos, videos and press come next — add them anytime from your profile to lift how often you get picked.
      </p>

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
          Add your sound, a one-line description, and your one-off floor to continue.
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Your voice
// ---------------------------------------------------------------------------

function StepVoice({
  samples,
  tones,
  onChange,
  onDone,
  onBack,
}: {
  samples: string;
  tones: Tone[];
  onChange: (next: { samples: string; tones: Tone[] }) => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const [result, formAction, pending] = useActionState<ActionResult, FormData>(
    async () => {
      const res = await saveVoiceSamples({ samples, tones });
      if (res.ok) onDone();
      return res;
    },
    null,
  );

  function toggleTone(t: Tone) {
    onChange({
      samples,
      tones: tones.includes(t) ? tones.filter((x) => x !== t) : [...tones, t],
    });
  }

  return (
    <form action={formAction} className="space-y-4">
      <StepHeading
        step={2}
        title="Your voice"
        blurb="This is the secret sauce. Paste 2-3 replies you've actually sent to clients — we'll write every draft the way you would, so nobody can tell you didn't type it."
      />

      <div>
        <label htmlFor="ob-voice" className={labelStyles}>
          Replies you’ve sent (the real ones, typos and all)
        </label>
        <textarea
          id="ob-voice"
          rows={9}
          value={samples}
          onChange={(e) => onChange({ samples: e.target.value, tones })}
          placeholder={
            "Hey Jess! Congrats on the engagement 🎉 June 14th is wide open for us…\n\nHi Mark — thanks for reaching out about the gala. Our corporate package starts at…"
          }
          className={`${inputStyles} font-mono text-xs leading-relaxed`}
        />
      </div>

      <div>
        <span className={labelStyles}>And the vibe is… (pick any)</span>
        <div className="flex flex-wrap gap-2">
          {TONES.map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => toggleTone(t)}
              aria-pressed={tones.includes(t)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                // Selected = cyan (interface voice); ink text on cyan (~7.5:1).
                tones.includes(t)
                  ? "bg-brand-cyan text-ink-stage shadow-sm"
                  : "border border-cream bg-white text-ink-stage/60 hover:border-brand-cyan/50"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-2">
        <BackButton onBack={onBack} />
        <div className="flex items-center gap-3">
          {result && !result.ok && <p className="text-sm text-red-600">{result.error}</p>}
          <button type="submit" disabled={pending} className={buttonStyles.primary}>
            {pending ? "Saving…" : "Next: your calendar →"}
          </button>
        </div>
      </div>
    </form>
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

  function updateRow(i: number, patch: Partial<GigRow>) {
    setRows(rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
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
          <div key={i} className="flex items-center gap-2">
            <input
              type="date"
              value={row.date}
              onChange={(e) => updateRow(i, { date: e.target.value })}
              className={`${inputStyles} w-40 flex-none`}
              aria-label={`Booked date ${i + 1}`}
            />
            <input
              value={row.title}
              onChange={(e) => updateRow(i, { title: e.target.value })}
              placeholder="Nguyen wedding"
              className={inputStyles}
              aria-label={`Title for booked date ${i + 1}`}
            />
            <button
              type="button"
              onClick={() => setRows(rows.filter((_, idx) => idx !== i))}
              className="flex-none rounded-full px-2 py-1 text-ink-stage/40 hover:text-red-600 transition-colors"
              aria-label={`Remove row ${i + 1}`}
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

function StepConnect({
  leadAddress,
  leadDetected,
  tookTooLong,
  onBack,
}: {
  leadAddress: string;
  leadDetected: boolean;
  /** ~90s elapsed on this step with no lead detected (audit C2 fallback). */
  tookTooLong: boolean;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <StepHeading
        step={4}
        title="Connect your leads"
        blurb="One forwarding rule and you're done forever: every inquiry — email, website form, The Knot, WeddingWire — lands here with a reply already drafted."
      />

      <div className="rounded-2xl border border-brand-cyan/40 bg-brand-cyan-soft/30 p-4">
        <p className="mb-2 font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-stage/60">
          Your lead address
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <code className="select-all break-all rounded-full bg-white px-4 py-2 font-mono text-sm font-semibold text-ink-stage shadow-sm">
            {leadAddress}
          </code>
          <CopyButton text={leadAddress} />
        </div>
      </div>

      <div className="space-y-2">
        <Walkthrough title="Gmail / Google Workspace">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              In Gmail, click the gear → <strong>See all settings</strong> →{" "}
              <strong>Forwarding and POP/IMAP</strong>.
            </li>
            <li>
              Click <strong>Add a forwarding address</strong> and paste your lead address above.
              Gmail sends a confirmation email — it shows up in your Bright Ears pipeline within a
              minute; open it there and click the confirmation link inside.
            </li>
            <li>
              Back in settings, open <strong>Filters and Blocked Addresses</strong> →{" "}
              <strong>Create a new filter</strong>.
            </li>
            <li>
              In <strong>From</strong>, list where your leads come from, e.g.{" "}
              <code className="rounded bg-cream px-1 font-mono text-xs">
                theknot.com OR weddingwire.com OR forms@yoursite.com
              </code>{" "}
              → <strong>Create filter</strong>.
            </li>
            <li>
              Tick <strong>“Forward it to:”</strong>, choose your lead address →{" "}
              <strong>Create filter</strong>. New leads now copy over automatically — the originals
              stay in your inbox.
            </li>
          </ol>
        </Walkthrough>

        <Walkthrough title="Outlook / Microsoft 365">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              In Outlook on the web, click the gear → <strong>Mail</strong> →{" "}
              <strong>Rules</strong> → <strong>Add new rule</strong>.
            </li>
            <li>Name it “Bright Ears leads”.</li>
            <li>
              Condition: <strong>From</strong> → add the senders your leads arrive from (The Knot
              and WeddingWire notifications, your website form’s sender).
            </li>
            <li>
              Action: <strong>Forward to</strong> → paste your lead address.
            </li>
            <li>Save — Outlook starts forwarding immediately, no confirmation step.</li>
          </ol>
        </Walkthrough>

        <Walkthrough title="The Knot & WeddingWire">
          <p className="mb-2">
            Both platforms email you a notification for every new lead — that notification is what
            we read. Two ways to route it:
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              <strong>Easiest:</strong> nothing to change on the platforms — your Gmail/Outlook
              rule above forwards their notification emails the moment they arrive.
            </li>
            <li>
              <strong>Direct:</strong> in The Knot vendor account (vendors.theknot.com) open{" "}
              <strong>Account → Notifications</strong> and set the lead-notification email to your
              lead address. WeddingWire vendors: <strong>Account → Email notifications</strong>,
              same idea. Your login email stays unchanged.
            </li>
          </ol>
        </Walkthrough>

        <Walkthrough title="Your website's contact form">
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              Open your form’s settings — WPForms / Gravity Forms / Contact Form 7 on WordPress,
              or the form block settings on Squarespace / Wix.
            </li>
            <li>
              Find <strong>“notification email”</strong> (sometimes “send entries to”) and add your
              lead address as a recipient. Keep your own email on the list if you like a copy.
            </li>
            <li>
              Submit your own form once to test — that counts for the live check below.
            </li>
          </ol>
        </Walkthrough>
      </div>

      {leadDetected ? (
        // The celebration moment — full magenta→orange gradient with sticker
        // chips (the show voice; ink text — white fails on the orange end).
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-neon-magenta to-neon-orange p-8 text-center shadow-[0_16px_44px_rgba(255,45,174,0.35)]">
          <div className="flex flex-wrap items-center justify-center gap-2.5">
            <StickerChip tone="cream" rotate={-4}>
              First lead caught ✓
            </StickerChip>
            <StickerChip tone="ink" rotate={3}>
              Now playing — your reply
            </StickerChip>
          </div>
          <p className="mt-4 text-xl font-extrabold tracking-tight text-ink-stage">
            Your first lead just landed — forwarding works.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-stage/75">
            We caught it and parsed it. Your assistant is set up and ready to reply in your voice and
            hunt venues for you — choose a plan to switch it on, and it goes to work on this lead and
            every one after.
          </p>
          <Link
            href="/dashboard/settings#billing"
            className="mt-5 inline-block rounded-full bg-ink-stage px-5 py-2.5 font-bold text-cream-bright hover:opacity-90 transition-opacity"
          >
            Choose your plan →
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl border-2 border-dashed border-brand-cyan/60 bg-white p-5">
          <p className="font-bold text-ink-stage">Prove it works — right now</p>
          <p className="mt-1 text-sm text-ink-stage/70">
            Send any email to your lead address from your phone — or forward a real inquiry sitting
            in your inbox. The second it arrives, this box lights up.
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm font-medium text-ink-stage/65">
            <span className="inline-block size-2 animate-pulse rounded-full bg-brand-cyan" aria-hidden />
            Listening for your first lead… (we check every 5 seconds)
          </p>
          {/* Calm fallback after ~90s (audit C2) — we keep listening; this just
              points at the usual culprit and reassures them they can move on. */}
          {tookTooLong && (
            <p className="mt-3 rounded-xl bg-cream/60 px-3 py-2 text-sm text-ink-stage/70">
              Taking longer than expected? Double-check your forwarding rule is
              pointing at the address above — or skip this and we&apos;ll catch your
              first lead whenever it arrives.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <BackButton onBack={onBack} />
        {!leadDetected && (
          <Link
            href="/dashboard"
            className="text-sm text-ink-stage/50 underline decoration-dotted underline-offset-4 hover:text-brand-cyan transition-colors"
          >
            I’ll test this later — take me to my dashboard
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
}: {
  initialStep: number;
  business: WizardBusiness;
  initialProfile: WizardProfile;
}) {
  const [step, setStep] = useState(() =>
    Math.min(Math.max(initialStep, 0), STEPS.length - 1),
  );
  const [profile, setProfile] = useState<WizardProfile>(initialProfile);
  // Step 1 derives the fee currency from the chosen country (THB for Thailand),
  // tracked here so step 2's fee labels are right even mid-session, no reload.
  const [country, setCountry] = useState(business.country);
  const currency = currencyForCountry(country);
  const [voice, setVoice] = useState<{ samples: string; tones: Tone[] }>(() => ({
    samples: stripToneNote(business.voiceSamples),
    tones: [],
  }));
  const [gigRows, setGigRows] = useState<GigRow[]>([
    { date: "", title: "" },
    { date: "", title: "" },
    { date: "", title: "" },
  ]);
  const [gigsSaved, setGigsSaved] = useState(0);
  const [leadDetected, setLeadDetected] = useState(false);
  // After ~90s of polling on step 5 with no lead detected, surface a calm
  // fallback (audit C2) so the spinner doesn't appear to hang forever. The live
  // verifier keeps running underneath and still flips to success if a lead lands.
  const [tookTooLong, setTookTooLong] = useState(false);

  const leadAddress = `leads@${business.slug}.in.brightears.io`;

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
        const data = (await res.json()) as { verified: boolean };
        if (!cancelled && data.verified) setLeadDetected(true);
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
              onDone={(c) => {
                setCountry(c);
                goTo(1);
              }}
            />
          )}
          {step === 1 && (
            <StepProfile
              profile={profile}
              currency={currency}
              onChange={setProfile}
              onDone={() => goTo(2)}
              onBack={() => goTo(0)}
            />
          )}
          {step === 2 && (
            <StepVoice
              samples={voice.samples}
              tones={voice.tones}
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
              onBack={() => goTo(3)}
            />
          )}
        </Card>
      </main>
    </div>
  );
}
