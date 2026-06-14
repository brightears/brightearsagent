"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { GradientBlob, StickerChip } from "@/components/collage";

/**
 * Transparent toy model — every step is shown to the user below the result.
 * `factor` = the share of your leads still realistically "in play" when your
 * reply lands. Couples inquire with several vendors at once and shortlist
 * whoever replies first, so every hour of delay hands a slice of your leads
 * to a faster DJ.
 */
const REPLY_SPEEDS = [
  { id: "5min", label: "Under 5 minutes", factor: 1.0 },
  { id: "1hour", label: "Within the hour", factor: 0.85 },
  { id: "fewhours", label: "A few hours later", factor: 0.7 },
  { id: "sameday", label: "By the end of the day", factor: 0.55 },
  { id: "nextday", label: "Next day or later", factor: 0.4 },
] as const;

type SpeedId = (typeof REPLY_SPEEDS)[number]["id"];

const RATE_CAP = 60; // % — past this, the model would be selling fantasy

const usd = (n: number) =>
  n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

/** Controlled number inputs hate NaN (cleared field) — render those as empty. */
const numValue = (n: number): number | "" => (Number.isNaN(n) ? "" : n);

function clamp(n: number, min: number, max: number): number {
  if (Number.isNaN(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/* The stat-hero number gets the show voice: magenta→orange gradient paint. */
const gradText: CSSProperties = {
  background: "linear-gradient(92deg, #ff2dae 5%, #ff8a00 95%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

export function LeadRoiCalculator() {
  const [leadsPerMonth, setLeadsPerMonth] = useState(10);
  const [bookingValue, setBookingValue] = useState(1800);
  const [bookingRate, setBookingRate] = useState(20);
  const [speed, setSpeed] = useState<SpeedId>("fewhours");

  const result = useMemo(() => {
    const leads = clamp(leadsPerMonth, 0, 1000);
    const value = clamp(bookingValue, 0, 100000);
    const rate = clamp(bookingRate, 0, 100);
    const speedDef = REPLY_SPEEDS.find((s) => s.id === speed) ?? REPLY_SPEEDS[2];

    const leadsPerYear = leads * 12;
    const bookingsNow = leadsPerYear * (rate / 100);
    const uncappedFastRate = speedDef.factor > 0 ? rate / speedDef.factor : rate;
    const fastRate = Math.min(uncappedFastRate, RATE_CAP);
    const capped = uncappedFastRate > RATE_CAP;
    const bookingsFast = leadsPerYear * (fastRate / 100);
    const bookingsLost = Math.max(0, bookingsFast - bookingsNow);
    const revenueLost = bookingsLost * value;

    return {
      leads,
      value,
      rate,
      speedDef,
      leadsPerYear,
      bookingsNow,
      fastRate,
      capped,
      bookingsFast,
      bookingsLost,
      revenueLost,
    };
  }, [leadsPerMonth, bookingValue, bookingRate, speed]);

  const alreadyFast = result.speedDef.id === "5min";

  // Cream-tinted inputs on the cream poster, cyan focus ring (interface voice).
  const inputClass =
    "w-full rounded-xl border border-ink-stage/15 bg-cream-bright px-4 py-2.5 text-sm text-ink-stage placeholder:text-ink-stage/40 focus:outline-none focus:ring-2 focus:ring-brand-cyan";
  const labelClass = "block text-sm font-bold text-ink-stage mb-1.5";

  return (
    <div className="space-y-8">
      {/* Inputs — cream poster panel */}
      <div className="relative">
        <GradientBlob tone="show" className="-bottom-8 -left-6 h-40 w-64" />
        <div className="relative overflow-hidden rounded-3xl bg-cream p-5 sm:p-7 shadow-[0_24px_60px_rgba(0,0,0,0.45)]">
          <div className="mb-5">
            <StickerChip tone="ink" rotate={-2}>
              Your real numbers
            </StickerChip>
          </div>
          <div className="grid sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="roi-leads" className={labelClass}>
                Inquiries you get per month
              </label>
              <input
                id="roi-leads"
                type="number"
                min={0}
                max={1000}
                value={numValue(leadsPerMonth)}
                onChange={(e) => setLeadsPerMonth(e.target.valueAsNumber)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="roi-value" className={labelClass}>
                Average booking value ($)
              </label>
              <input
                id="roi-value"
                type="number"
                min={0}
                max={100000}
                step={100}
                value={numValue(bookingValue)}
                onChange={(e) => setBookingValue(e.target.valueAsNumber)}
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor="roi-rate" className={labelClass}>
                Your current booking rate (%)
              </label>
              <input
                id="roi-rate"
                type="number"
                min={0}
                max={100}
                value={numValue(bookingRate)}
                onChange={(e) => setBookingRate(e.target.valueAsNumber)}
                className={inputClass}
              />
              <p className="text-xs text-ink-stage/50 mt-1">
                Of 10 inquiries, how many become gigs?
              </p>
            </div>
            <div>
              <label htmlFor="roi-speed" className={labelClass}>
                How fast do you usually reply?
              </label>
              <select
                id="roi-speed"
                value={speed}
                onChange={(e) => setSpeed(e.target.value as SpeedId)}
                className={inputClass}
              >
                {REPLY_SPEEDS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-ink-stage/50 mt-1">
                Honestly — including mid-gig and asleep.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Result — the "NOW PLAYING" poster */}
      <div className="relative">
        <GradientBlob tone="show" className="-bottom-8 -right-6 h-40 w-64" />
        <div className="relative overflow-hidden rounded-3xl bg-cream shadow-[0_24px_60px_rgba(0,0,0,0.45)] rotate-[0.4deg]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 sm:px-8 pt-6">
            <StickerChip tone="outline">Now playing — your year</StickerChip>
            <StickerChip tone="magenta" rotate={3}>
              {result.speedDef.label}
            </StickerChip>
          </div>

          {alreadyFast ? (
            <div className="p-6 sm:p-8 text-center space-y-3">
              <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-ink-stage">
                You&apos;re already in the fast lane.
              </p>
              <p className="text-ink-stage/65 max-w-xl mx-auto">
                Replying in under 5 minutes is exactly where you want to be — your slow-reply leak
                is roughly <strong className="text-ink-stage">$0</strong>. The only question is
                what it costs you to keep it up: the 2am drafting, the mid-set phone checks, the
                laptop you fall asleep on. That part we can take off your hands.
              </p>
            </div>
          ) : (
            <div className="p-6 sm:p-8 text-center space-y-2">
              <p className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-ink-stage/55">
                Estimated cost of slow replies
              </p>
              <p className="text-4xl sm:text-5xl font-black tracking-tight">
                <span style={gradText}>{usd(result.revenueLost)}</span>
                <span className="text-lg font-semibold text-ink-stage/45"> / year</span>
              </p>
              <p className="text-ink-stage/65">
                ≈{" "}
                <strong className="text-ink-stage">
                  {result.bookingsLost.toFixed(1)} bookings a year
                </strong>{" "}
                going to whoever replied first.
              </p>
            </div>
          )}

          {/* The math, in full */}
          <div className="border-t border-ink-stage/10 bg-cream-bright/70 p-6 sm:p-8">
            <h3 className="font-extrabold tracking-tight text-ink-stage mb-4">
              The math, step by step
            </h3>
            <ol className="space-y-3 text-sm text-ink-stage/75 leading-relaxed">
              <li>
                <strong className="text-ink-stage">1. Your year:</strong> {result.leads}{" "}
                inquiries/month × 12 = <strong>{result.leadsPerYear} inquiries</strong>. At your{" "}
                {result.rate}% booking rate, that&apos;s{" "}
                <strong>{result.bookingsNow.toFixed(1)} bookings</strong>.
              </li>
              <li>
                <strong className="text-ink-stage">2. The speed assumption:</strong> couples
                inquire with several vendors at once and shortlist whoever replies first — about a
                third of vendors never reply at all. Our model says that replying{" "}
                <strong>{result.speedDef.label.toLowerCase()}</strong> means roughly{" "}
                <strong>{Math.round(result.speedDef.factor * 100)}%</strong> of your leads are
                still in play when your reply lands. The rest have already started talking to a
                faster DJ.
              </li>
              <li>
                <strong className="text-ink-stage">3. Same you, faster reply:</strong> your{" "}
                {result.rate}% rate is what survives that filter. Reply in under 5 minutes and the
                same pitch works on the full pool: {result.rate}% ÷{" "}
                {result.speedDef.factor.toFixed(2)} ≈{" "}
                <strong>{result.fastRate.toFixed(1)}%</strong>
                {result.capped && (
                  <span className="text-ink-stage/50">
                    {" "}
                    (capped at {RATE_CAP}% — no model should promise you more than that)
                  </span>
                )}
                , or <strong>{result.bookingsFast.toFixed(1)} bookings</strong> from the same{" "}
                {result.leadsPerYear} inquiries.
              </li>
              <li>
                <strong className="text-ink-stage">4. The gap:</strong>{" "}
                {result.bookingsFast.toFixed(1)} − {result.bookingsNow.toFixed(1)} ={" "}
                <strong>{result.bookingsLost.toFixed(1)} bookings/year</strong> ×{" "}
                {usd(result.value)} = <strong>{usd(result.revenueLost)}</strong>.
              </li>
            </ol>
            <p className="text-xs text-ink-stage/50 mt-5 leading-relaxed">
              This is a planning model, not a promise — your market, lead sources, and pricing all
              move the number. What isn&apos;t in question is the direction: couples book whoever
              replies first, and every hour of silence shrinks your pool. Change the inputs above
              and watch the leak move.
            </p>
          </div>
        </div>
      </div>

      {/* Bridge */}
      {!alreadyFast && result.revenueLost > 0 && (
        <div className="relative">
          <div className="relative overflow-hidden rounded-3xl bg-cream p-5 sm:p-7 text-center space-y-3 shadow-[0_24px_60px_rgba(0,0,0,0.45)] rotate-[-0.4deg]">
            <p className="text-ink-stage font-extrabold tracking-tight text-lg">
              Plugging the leak costs $79/month. The leak costs {usd(result.revenueLost)}/year.
            </p>
            <p className="text-sm text-ink-stage/65 max-w-xl mx-auto">
              Bright Ears replies to every inquiry in under 5 minutes — in your voice, from your
              rate card, with your real availability — then follows up until it&apos;s booked or
              dead. You approve from your phone, even from the booth. 30-day money-back guarantee.
            </p>
            <Link
              href="/onboarding"
              className="inline-block rounded-full bg-neon-magenta text-white font-bold px-7 py-3 shadow-[0_10px_36px_rgba(255,45,174,0.45)] hover:opacity-90 transition-opacity"
            >
              Start free
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
