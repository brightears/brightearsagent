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
import { createPackage } from "@/app/actions/packages";
import {
  addBookedDates,
  saveBusinessBasics,
  saveVoiceSamples,
} from "@/app/actions/onboarding";
import { buttonStyles, Badge, BrightEarsLogo, Card } from "@/components/ui";
import { RingsBackdrop, StickerChip } from "@/components/collage";
import { CopyButton } from "@/components/settings-form";
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
  { label: "Your business", emoji: "🪩", chip: "bg-brand-cyan text-ink-stage" },
  { label: "What you sell", emoji: "💸", chip: "bg-neon-magenta text-white" },
  { label: "Your voice", emoji: "💬", chip: "bg-neon-orange text-ink-stage" },
  { label: "Your calendar", emoji: "📅", chip: "bg-brand-cyan text-ink-stage" },
  { label: "Connect leads", emoji: "⚡", chip: "bg-neon-magenta text-white" },
] as const;

const KINDS: { kind: PerformerKind; emoji: string; label: string }[] = [
  { kind: "DJ", emoji: "🎧", label: "DJ" },
  { kind: "BAND", emoji: "🎸", label: "Band" },
  { kind: "SINGER", emoji: "🎤", label: "Singer" },
  { kind: "MAGICIAN", emoji: "🎩", label: "Magician" },
  { kind: "DANCER", emoji: "🕺", label: "Dancer" },
  { kind: "MC", emoji: "🎙️", label: "MC / Host" },
  { kind: "PHOTO_BOOTH", emoji: "📸", label: "Photo booth" },
  { kind: "MUSICIAN", emoji: "🎻", label: "Musician" },
  { kind: "COMEDIAN", emoji: "😄", label: "Comedian" },
  { kind: "OTHER", emoji: "✨", label: "Something else" },
];

// US/UK/AU/CA first — our launch markets.
const COUNTRIES: { code: string; label: string }[] = [
  { code: "US", label: "United States" },
  { code: "GB", label: "United Kingdom" },
  { code: "AU", label: "Australia" },
  { code: "CA", label: "Canada" },
  { code: "NZ", label: "New Zealand" },
  { code: "IE", label: "Ireland" },
  { code: "DE", label: "Germany" },
  { code: "FR", label: "France" },
  { code: "SG", label: "Singapore" },
  { code: "TH", label: "Thailand" },
];

const EVENT_TYPES = ["wedding", "corporate", "birthday", "private party", "school dance"];

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

export interface WizardPackage {
  name: string;
  priceMinDollars: number;
  priceMaxDollars: number | null;
  eventTypes: string[];
}

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function priceLabel(pkg: WizardPackage) {
  return pkg.priceMaxDollars === null
    ? usd.format(pkg.priceMinDollars)
    : `${usd.format(pkg.priceMinDollars)}–${usd.format(pkg.priceMaxDollars)}`;
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
  onDone: () => void;
}) {
  const [kind, setKind] = useState<PerformerKind>(initial.performerKind);
  const [result, formAction, pending] = useActionState<ActionResult, FormData>(
    async (_prev, fd) => {
      const res = await saveBusinessBasics({
        name: String(fd.get("name") ?? ""),
        ownerName: String(fd.get("ownerName") ?? ""),
        performerKind: kind,
        country: String(fd.get("country") ?? ""),
        timezone: String(fd.get("timezone") ?? ""),
        websiteUrl: String(fd.get("websiteUrl") ?? ""),
      });
      if (res.ok) onDone();
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

  const countries = COUNTRIES.some((c) => c.code === initial.country)
    ? COUNTRIES
    : [{ code: initial.country, label: initial.country }, ...COUNTRIES];

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
              className={`flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-xs font-semibold transition-all ${
                kind === k.kind
                  ? "border-brand-cyan bg-brand-cyan-soft/60 text-ink-stage ring-2 ring-brand-cyan shadow-sm"
                  : "border-cream bg-white text-ink-stage/70 hover:-translate-y-0.5 hover:border-brand-cyan/40 hover:shadow-md"
              }`}
            >
              <span className="text-2xl" aria-hidden>{k.emoji}</span>
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
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-stage/50">Sets the right email rules for your region.</p>
        </div>
        <div>
          <label htmlFor="ob-tz" className={labelStyles}>Timezone</label>
          <select id="ob-tz" name="timezone" defaultValue={initial.timezone} className={inputStyles}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>{tz.replaceAll("_", " ")}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-stage/50">So “are you free June 14th?” means your June 14th.</p>
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
          placeholder="yourdjsite.com"
          className={inputStyles}
        />
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {result && !result.ok && <p className="text-sm text-red-600">{result.error}</p>}
        <button type="submit" disabled={pending} className={buttonStyles.primary}>
          {pending ? "Saving…" : "Next: what you sell →"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — What you sell (1-3 packages, at least one required)
// ---------------------------------------------------------------------------

const MAX_ONBOARDING_PACKAGES = 3;

function StepPackages({
  packages,
  onAdded,
  onDone,
  onBack,
}: {
  packages: WizardPackage[];
  onAdded: (pkg: WizardPackage) => void;
  onDone: () => void;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [types, setTypes] = useState<string[]>(["wedding"]);
  const [otherTypes, setOtherTypes] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canAddMore = packages.length < MAX_ONBOARDING_PACKAGES;

  function toggleType(t: string) {
    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  }

  async function handleAdd() {
    setError(null);
    if (!name.trim()) return setError("Give the package a name");
    if (!priceMin.trim()) return setError("What does it start at?");

    const eventTypes = [...types, otherTypes].map((t) => t.trim()).filter(Boolean).join(", ");
    const fd = new FormData();
    fd.set("name", name);
    fd.set("description", "");
    fd.set("priceMin", priceMin);
    fd.set("priceMax", priceMax);
    fd.set("eventTypes", eventTypes);

    setPending(true);
    try {
      // createPackage's inferred return widens `ok` to boolean — annotate for narrowing.
      const res: { ok: boolean; error?: string } = await createPackage(fd);
      if (!res.ok) return setError(res.error ?? "Could not save that package — try again");
      onAdded({
        name: name.trim(),
        priceMinDollars: Number(priceMin),
        priceMaxDollars: priceMax.trim() ? Number(priceMax) : null,
        eventTypes: eventTypes.split(",").map((t) => t.trim().toLowerCase()).filter(Boolean),
      });
      setName("");
      setPriceMin("");
      setPriceMax("");
      setOtherTypes("");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <StepHeading
        step={1}
        title="What you sell"
        blurb="Your rate card — we only ever quote what you put here, never a number we made up. Add 1-3 packages; polish them later under Packages."
      />

      {packages.length > 0 && (
        <ul className="space-y-2">
          {packages.map((pkg, i) => (
            <li
              key={`${pkg.name}-${i}`}
              className="flex flex-wrap items-center gap-2 rounded-2xl border border-brand-cyan/40 bg-brand-cyan-soft/40 px-4 py-3"
            >
              <span aria-hidden>✅</span>
              <span className="font-semibold text-ink-stage">{pkg.name}</span>
              <span className="text-sm text-ink-stage/70">{priceLabel(pkg)}</span>
              <span className="ml-auto flex flex-wrap gap-1">
                {pkg.eventTypes.slice(0, 3).map((t) => (
                  <Badge key={t} tone="gray">{t}</Badge>
                ))}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canAddMore ? (
        <div className="space-y-3 rounded-2xl border border-dashed border-ink-stage/25 bg-cream/30 p-4">
          <div>
            <label htmlFor="ob-pkg-name" className={labelStyles}>Package name</label>
            <input
              id="ob-pkg-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="6-hour wedding package"
              className={inputStyles}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="ob-pkg-min" className={labelStyles}>Price from ($)</label>
              <input
                id="ob-pkg-min"
                type="number"
                min={0}
                step="0.01"
                value={priceMin}
                onChange={(e) => setPriceMin(e.target.value)}
                placeholder="1800"
                className={inputStyles}
              />
            </div>
            <div>
              <label htmlFor="ob-pkg-max" className={labelStyles}>To ($, blank = fixed)</label>
              <input
                id="ob-pkg-max"
                type="number"
                min={0}
                step="0.01"
                value={priceMax}
                onChange={(e) => setPriceMax(e.target.value)}
                placeholder="2400"
                className={inputStyles}
              />
            </div>
          </div>
          <div>
            <span className={labelStyles}>Good for</span>
            <div className="flex flex-wrap gap-2">
              {EVENT_TYPES.map((t) => (
                <button
                  type="button"
                  key={t}
                  onClick={() => toggleType(t)}
                  aria-pressed={types.includes(t)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    // Selected = cyan (interface voice); ink text on cyan (~7.5:1).
                    types.includes(t)
                      ? "bg-brand-cyan text-ink-stage"
                      : "border border-cream bg-white text-ink-stage/60 hover:border-brand-cyan/50"
                  }`}
                >
                  {t}
                </button>
              ))}
              <input
                value={otherTypes}
                onChange={(e) => setOtherTypes(e.target.value)}
                placeholder="anything else, comma-separated"
                className={`${inputStyles} w-56 flex-none px-3 py-1 text-xs`}
                aria-label="Other event types"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={pending}
            className={`${buttonStyles.secondaryOnLight} w-full`}
          >
            {pending ? "Adding…" : packages.length === 0 ? "Add this package" : "+ Add another package"}
          </button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      ) : (
        <p className="rounded-2xl bg-cream/50 px-4 py-3 text-sm text-ink-stage/60">
          Three’s plenty to start — you can add more anytime under Packages.
        </p>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <BackButton onBack={onBack} />
        <button
          type="button"
          onClick={onDone}
          disabled={packages.length === 0}
          className={buttonStyles.primary}
        >
          Next: your voice →
        </button>
      </div>
      {packages.length === 0 && (
        <p className="text-right text-xs text-ink-stage/50">
          Add at least one package so we know what to quote.
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
        <p className="rounded-2xl bg-brand-cyan-soft/60 px-4 py-2 text-sm font-medium text-ink-stage">
          ✅ {savedCount} {savedCount === 1 ? "date" : "dates"} already saved to your calendar
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
              ✕
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
  icon,
  title,
  children,
}: {
  icon: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-2xl border border-cream bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-semibold text-ink-stage [&::-webkit-details-marker]:hidden">
        <span aria-hidden>{icon}</span>
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
  onBack,
}: {
  leadAddress: string;
  leadDetected: boolean;
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
        <Walkthrough icon="✉️" title="Gmail / Google Workspace">
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

        <Walkthrough icon="📮" title="Outlook / Microsoft 365">
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

        <Walkthrough icon="💍" title="The Knot & WeddingWire">
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

        <Walkthrough icon="🌐" title="Your website's contact form">
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
              Submit your own form once to test — that counts for the live check below. 😉
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
            Your first lead just landed — check your phone.
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-ink-stage/75">
            We caught it, parsed it, and a reply is being drafted in your voice right now. That’s
            what happens to every inquiry from here on — even when you’re mid-set.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-block rounded-full bg-ink-stage px-5 py-2.5 font-bold text-cream-bright hover:opacity-90 transition-opacity"
          >
            Take me to my pipeline →
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

/** Strip a previously saved tone note so re-saving doesn't stack two of them. */
function stripToneNote(samples: string | null): string {
  return (samples ?? "").replace(/\n\n\[Tone: [^\]]*\]\s*$/, "");
}

export function OnboardingWizard({
  initialStep,
  business,
  existingPackages,
}: {
  initialStep: number;
  business: WizardBusiness;
  existingPackages: WizardPackage[];
}) {
  const [step, setStep] = useState(() =>
    Math.min(Math.max(initialStep, 0), STEPS.length - 1),
  );
  const [packages, setPackages] = useState<WizardPackage[]>(existingPackages);
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
            Five quick steps — under ten minutes — and every inquiry you get starts answering
            itself, in your voice.
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
                        : "border-[1.5px] border-cream/25 bg-cream/5 text-cream/45"
                  }`}
                >
                  <span aria-hidden>{done ? "✓" : s.emoji}</span>
                  <span className="hidden sm:inline">{s.label}</span>
                  <span className="sm:hidden">{i + 1}</span>
                </button>
              </li>
            );
          })}
        </ol>

        <Card className="p-6 sm:p-8">
          {step === 0 && <StepBusiness initial={business} onDone={() => goTo(1)} />}
          {step === 1 && (
            <StepPackages
              packages={packages}
              onAdded={(pkg) => setPackages((prev) => [...prev, pkg])}
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
              onBack={() => goTo(3)}
            />
          )}
        </Card>
      </main>
    </div>
  );
}
