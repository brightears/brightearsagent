import type { Metadata } from "next";
import { pageMeta } from "@/lib/marketing/site";
import Link from "next/link";
import { Kicker } from "@/components/ui";

export const metadata: Metadata = pageMeta(
  "Roadmap — Bright Ears",
  "What's live, what's being built, and what's next for the AI that finds gigs for performers. The public roadmap our comparison pages point to.",
);

// The PUBLIC roadmap (audit 2026-07: /compare cited "our public roadmap" three
// times — including inside JSON-LD served to search engines — and no such page
// existed, on the site whose whole premise is verifiable honesty).
//
// Honesty rules for this page: SHIPPED means live in the product today.
// BUILDING means in active development. ON THE ROADMAP means decided and
// sequenced, with its gate named when one exists. Nothing speculative.

const SHIPPED = [
  "Inbound inquiries answered in your voice — email forwarding + platform lead alerts, spam filtered, availability-aware drafts you approve",
  "Follow-up sequences that run until booked or gone quiet, with one-tap opt-out for clients",
  "The Hunt: venue discovery in your cities, fit-scored with the reasons spelled out",
  "Venue pitches drafted in your voice, sent from your own Gmail after your approval",
  "Travel Mode — point the hunt at a city for the dates you'll be there",
  "White-label press kit page + PDF, quote engine with PDF quotations",
  "Calendar with recurring residencies and time-aware availability",
  "Weekly report of what your agent did",
];

const BUILDING = [
  "Venue replies flowing back into your pipeline automatically (reply capture)",
  "Overnight pitch drafting with a morning approve-queue digest",
  "Every-artist venue matching — magicians, dancers, actors and more, not just music acts",
  "A faster phone experience: approval queue first, bottom navigation",
];

const ROADMAP = [
  {
    item: "Quote → contract-lite e-sign → deposit via your own payment link",
    note: "Sequenced behind our first paying cohort — we build the money path with real customers, not before them.",
  },
  {
    item: "Telegram remote control — approve pitches without opening the app",
    note: "Next major addition after the current build cycle.",
  },
  {
    item: "Multilingual, culturally-tuned pitches",
    note: "The engine already handles per-country compliance; recipient-language drafting follows.",
  },
  {
    item: "Microsoft/Outlook sending for venue pitches",
    note: "Gmail shipped first; Outlook follows demand.",
  },
];

export default function RoadmapPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <Kicker>The public roadmap</Kicker>
      <h1 className="mt-2 text-4xl font-black tracking-tight text-cream-bright sm:text-5xl">
        Built in the open,{" "}
        <span className="bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent">
          promised in writing.
        </span>
      </h1>
      <p className="mt-4 max-w-xl text-cream/60">
        Our comparison pages point here when they say something is coming. Three lists, no
        speculation: live today, in active development, and decided-and-sequenced.
      </p>

      <section className="mt-12">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-brand-cyan">
          Live today
        </h2>
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-cream/75">
          {SHIPPED.map((s) => (
            <li key={s} className="flex gap-3">
              <span aria-hidden className="mt-2 size-1.5 flex-none bg-brand-cyan" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-neon-orange">
          Building now
        </h2>
        <ul className="mt-4 space-y-2.5 text-sm leading-relaxed text-cream/75">
          {BUILDING.map((s) => (
            <li key={s} className="flex gap-3">
              <span aria-hidden className="mt-2 size-1.5 flex-none bg-neon-orange" />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs font-bold uppercase tracking-[0.2em] text-cream/50">
          On the roadmap
        </h2>
        <ul className="mt-4 space-y-4 text-sm leading-relaxed">
          {ROADMAP.map((r) => (
            <li key={r.item} className="flex gap-3">
              <span aria-hidden className="mt-2 size-1.5 flex-none rounded-full border border-cream/40" />
              <div>
                <p className="text-cream/75">{r.item}</p>
                <p className="mt-0.5 text-xs text-cream/45">{r.note}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="mt-12 text-xs text-cream/45">
        What you won&apos;t find here: client-facing portals, a marketplace between you and your
        clients, or anything that puts our name in front of yours. Those aren&apos;t roadmap items —
        they&apos;re non-goals.
      </p>

      <div className="mt-10">
        <Link
          href="/compare"
          className="font-mono text-[11px] font-bold uppercase tracking-[0.2em] text-brand-cyan hover:opacity-80"
        >
          ← Back to the comparisons
        </Link>
      </div>
    </main>
  );
}
