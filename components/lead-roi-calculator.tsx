"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

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

  const inputClass =
    "w-full rounded-xl border border-off-white bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-cyan";
  const labelClass = "block text-sm font-semibold text-deep-teal mb-1.5";

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="rounded-2xl bg-white shadow-sm border border-off-white p-5 sm:p-7">
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
            <p className="text-xs text-ink/40 mt-1">Of 10 inquiries, how many become gigs?</p>
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
            <p className="text-xs text-ink/40 mt-1">Honestly — including mid-gig and asleep.</p>
          </div>
        </div>
      </div>

      {/* Result */}
      <div className="rounded-2xl bg-white shadow-sm border border-off-white overflow-hidden">
        {alreadyFast ? (
          <div className="p-6 sm:p-8 text-center space-y-3">
            <p className="text-2xl sm:text-3xl font-bold text-deep-teal">
              You&apos;re already in the fast lane.
            </p>
            <p className="text-ink/70 max-w-xl mx-auto">
              Replying in under 5 minutes is exactly where you want to be — your slow-reply leak is
              roughly <strong>$0</strong>. The only question is what it costs you to keep it up:
              the 2am drafting, the mid-set phone checks, the laptop you fall asleep on. That part
              we can take off your hands.
            </p>
          </div>
        ) : (
          <div className="p-6 sm:p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-ink/50 uppercase tracking-wide">
              Estimated cost of slow replies
            </p>
            <p className="text-4xl sm:text-5xl font-bold text-deep-teal">
              {usd(result.revenueLost)}
              <span className="text-lg font-semibold text-ink/40"> / year</span>
            </p>
            <p className="text-ink/70">
              ≈ <strong>{result.bookingsLost.toFixed(1)} bookings a year</strong> going to whoever
              replied first.
            </p>
          </div>
        )}

        {/* The math, in full */}
        <div className="border-t border-off-white bg-background/60 p-6 sm:p-8">
          <h3 className="font-bold text-deep-teal mb-4">The math, step by step</h3>
          <ol className="space-y-3 text-sm text-ink/80 leading-relaxed">
            <li>
              <strong className="text-deep-teal">1. Your year:</strong> {result.leads}{" "}
              inquiries/month × 12 = <strong>{result.leadsPerYear} inquiries</strong>. At your{" "}
              {result.rate}% booking rate, that&apos;s{" "}
              <strong>{result.bookingsNow.toFixed(1)} bookings</strong>.
            </li>
            <li>
              <strong className="text-deep-teal">2. The speed assumption:</strong> couples inquire
              with several vendors at once and shortlist whoever replies first — about a third of
              vendors never reply at all. Our model says that replying{" "}
              <strong>{result.speedDef.label.toLowerCase()}</strong> means roughly{" "}
              <strong>{Math.round(result.speedDef.factor * 100)}%</strong> of your leads are still
              in play when your reply lands. The rest have already started talking to a faster DJ.
            </li>
            <li>
              <strong className="text-deep-teal">3. Same you, faster reply:</strong> your{" "}
              {result.rate}% rate is what survives that filter. Reply in under 5 minutes and the
              same pitch works on the full pool: {result.rate}% ÷{" "}
              {result.speedDef.factor.toFixed(2)} ≈{" "}
              <strong>{result.fastRate.toFixed(1)}%</strong>
              {result.capped && (
                <span className="text-ink/50">
                  {" "}
                  (capped at {RATE_CAP}% — no model should promise you more than that)
                </span>
              )}
              , or <strong>{result.bookingsFast.toFixed(1)} bookings</strong> from the same{" "}
              {result.leadsPerYear} inquiries.
            </li>
            <li>
              <strong className="text-deep-teal">4. The gap:</strong>{" "}
              {result.bookingsFast.toFixed(1)} − {result.bookingsNow.toFixed(1)} ={" "}
              <strong>{result.bookingsLost.toFixed(1)} bookings/year</strong> ×{" "}
              {usd(result.value)} = <strong>{usd(result.revenueLost)}</strong>.
            </li>
          </ol>
          <p className="text-xs text-ink/50 mt-5 leading-relaxed">
            This is a planning model, not a promise — your market, lead sources, and pricing all
            move the number. What isn&apos;t in question is the direction: couples book whoever
            replies first, and every hour of silence shrinks your pool. Change the inputs above and
            watch the leak move.
          </p>
        </div>
      </div>

      {/* Bridge */}
      {!alreadyFast && result.revenueLost > 0 && (
        <div className="rounded-2xl bg-soft-lavender/15 border border-soft-lavender/40 p-5 sm:p-7 text-center space-y-3">
          <p className="text-deep-teal font-bold text-lg">
            Plugging the leak costs $79/month. The leak costs {usd(result.revenueLost)}/year.
          </p>
          <p className="text-sm text-ink/70 max-w-xl mx-auto">
            Bright Ears replies to every inquiry in under 5 minutes — in your voice, from your rate
            card, with your real availability — then follows up until it&apos;s booked or dead. You
            approve from your phone, even from the booth. 14-day free trial, no card.
          </p>
          <Link
            href="/onboarding"
            className="inline-block rounded-xl bg-brand-cyan text-white font-semibold px-6 py-3 hover:opacity-90 transition-opacity"
          >
            Start free
          </Link>
        </div>
      )}
    </div>
  );
}
