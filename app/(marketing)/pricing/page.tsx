import type { Metadata } from "next";
import { pageMeta } from "@/lib/marketing/site";
import Link from "next/link";
import {
  GradientBlob,
  HaloRing,
  RingsBackdrop,
  StickerChip,
  VinylDisc,
} from "@/components/collage";
import { RISK_REVERSAL } from "@/lib/marketing/guarantee";

export const metadata: Metadata = pageMeta(
  "Pricing — Bright Ears",
  "Finds gigs, drafts the pitch and every reply in your voice — you approve. Starter $25, Pro $79, Studio $149. Every plan is the complete engine.",
);

type Plan = {
  name: string;
  price: string;
  blurb: string;
  features: string[];
  highlighted?: boolean;
};

// Tier recut per docs/ADR-003-scope-vs-price.md Stage 1: every tier is the
// COMPLETE engine (the Hunt, replies, sequences, weekly report, spam filtering,
// approve-from-phone, Travel Mode, AND the same maxed research quality). Plans
// differ only in capacity and autonomy — how many inquiries you answer, how many
// cities you hunt, and how much auto-send. Never capability-gate copy here again,
// and never gate research quality — it's the moat and it's full on every plan.
const PLANS: Plan[] = [
  {
    name: "Starter",
    price: "$25",
    blurb:
      "The complete engine for a solo performer in one home city — it hunts venues for you AND answers your incoming inquiries. You approve every send.",
    features: [
      "The Hunt: it finds venues hiring entertainment and drafts the outreach in your voice — you approve every pitch",
      "The same deep research as every plan — full quality, never throttled",
      "Hunts your 1 home city",
      "Answers up to 15 of your incoming inquiries a month (weddings, corporate, parties — any event)",
      "1 performer (you)",
      "Travel Mode: tell it where you're touring and the dates — it hunts gigs in that city for those days, anywhere in the world",
      "Everything drafted in your voice — from your rate card, checked against your gig calendar",
      "Follow-up sequences until every inquiry is booked or dead, opt-out compliance built in",
      "Weekly report: rooms found, inquiries answered, gigs booked",
      "Spam & scams filtered before you ever see them",
      "You approve every send — one tap from your phone, even backstage",
      "Also catches plain email, your website forms, The Knot, WeddingWire, Bark & GigSalad",
    ],
  },
  {
    name: "Pro",
    price: "$79",
    blurb:
      "The same engine, more headroom — it hunts more cities, answers more of your inquiries, and can send for itself on sources you trust.",
    features: [
      "Everything in Starter — the same Hunt, the same complete engine, the same deep research",
      "Answers up to 60 of your incoming inquiries a month",
      "Hunts up to 3 cities",
      "Auto-send: full autopilot on the sources you trust, approval everywhere else",
    ],
    highlighted: true,
  },
  {
    name: "Studio",
    price: "$149",
    blurb:
      "The same engine at full stretch — the biggest inquiry ceiling, and the hunt running on every city you play.",
    features: [
      "Everything in Pro — the same deep research, the same complete engine",
      "Answers up to 150 of your incoming inquiries a month",
      "Hunts all your cities",
      "Auto-send on the sources you trust — the most headroom for a busy season",
      "A roster: multiple performers, gigs tagged per performer, availability checked per performer",
    ],
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "What's the difference between Starter, Pro and Studio?",
    a: "Capacity and autonomy — never features, and never research quality. Every plan includes the complete engine: the proactive Hunt that finds venues and drafts outreach for you, replies to every incoming inquiry in your voice, follow-up sequences until booked-or-dead, the weekly report, spam filtering, Travel Mode, approve-from-phone — and the same deep research on every plan. Starter ($25) answers up to 15 of your incoming inquiries a month, hunts your 1 home city, for 1 performer, and you approve every send. Pro ($79) answers up to 60 inquiries, hunts up to 3 cities, and adds auto-send — full autopilot on the sources you trust. Studio ($149) answers up to 150 inquiries, hunts all your cities, with auto-send on the sources you trust — and runs a roster of performers, with gigs and availability tracked per performer. The Hunt's venue-pitch allowance is the same on every plan.",
  },
  {
    q: "Is this only for wedding performers?",
    a: "No. Bright Ears works for any bookable performer business and any event type — weddings, corporate and brand events, private parties, bar/club/hotel residencies, festivals and launches. DJs, bands, singers, dancers, magicians, MCs and more all run it; the replies use your packages, your rates and your voice, whatever you book.",
  },
  {
    q: "What's the Hunt — the proactive venue agent?",
    a: "Alongside answering your incoming inquiries, Bright Ears proactively looks for venues hiring entertainment, scores how well each one fits you, and drafts outreach in your voice. You review and approve, and it sends — so quiet weeks don't stay quiet. It's separate from the inquiries you answer each month, runs on the same deep research as every plan, and it never guarantees bookings — results depend on demand in your area.",
  },
  {
    q: "What if it isn't working for me?",
    a: "It's month-to-month — cancel anytime in two clicks, and at your monthly cap we pause instead of billing you more. For scale: a single $1,800 booking (an example, not a promise) would cover six years of Starter.",
  },
  {
    q: "I travel for gigs — does it work when I'm on the road?",
    a: "Yes — Travel Mode is included on every plan. Set a home base and add travel windows (a city and the dates you'll be there), and the Hunt also scans that city for those days, drafting date-bounded outreach in your voice for you to approve from the road. It works anywhere in the world and the compliance footer follows the destination country. Like the rest of the Hunt, it finds and pitches the opportunities — results still depend on local demand.",
  },
  {
    q: "Is email forwarding safe? Do I have to share my password?",
    a: "No passwords, no inbox access, no OAuth permissions. You add one simple forwarding rule in your own email or lead platform that sends inquiry notifications to your private Bright Ears address. You stay in full control and can switch the forward off anytime.",
  },
  {
    q: "What counts as an inquiry?",
    a: "Your monthly number is a ceiling on your own incoming inquiries — a real inquiry from a real prospect (someone asking about your availability, pricing or services) that we parse and draft a reply for. One prospect = one inquiry, no matter how many emails go back and forth. Venue pitches from the Hunt are a separate allowance and never count against this number.",
  },
  {
    q: "Does spam count against my monthly inquiries?",
    a: "No. Spam, scams and vendor junk are filtered before you ever see them, and they never count toward your monthly cap. You only pay for real prospects.",
  },
  {
    q: "What happens when I hit my monthly cap?",
    a: "Drafting pauses for the rest of the month and we notify you immediately — we never silently bill you more. New inquiries still arrive and nothing is lost; to switch drafting back on right away, upgrade your plan in one click. Your cap resets at the start of next month. No surprise bills, ever.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Every plan is month-to-month with no contract. Cancel from your settings in two clicks and your forwarding simply stops working with us — your inbox keeps working exactly as before.",
  },
  {
    q: "Will my clients know an AI is involved?",
    a: "No. Bright Ears is fully white-label: replies go out under your business name, prospects reply straight to you, every word is written in your voice from your rate card — and you approve it. Your clients see a fast, professional performer. Nothing else.",
  },
  {
    q: "Which platforms does it work with?",
    a: "Plain email and your own website contact forms, plus The Knot, WeddingWire, Bark and GigSalad lead notification emails — all through the same simple forwarding setup. It works with any platform that emails you, anywhere in the world: if an inquiry lands in your inbox, we can catch it.",
  },
  {
    q: "How do you handle opt-outs and spam laws?",
    a: "Every follow-up carries a one-tap opt-out and the correct compliance footer for your country (CAN-SPAM in the US, PECR in the UK, CASL in Canada, Spam Act in Australia). Sequences hard-stop the moment a prospect replies, books, opts out, or you mark the lead dead.",
  },
  {
    q: "What if I hate a draft?",
    a: "Edit it in a tap or toss it — nothing is sent without your approval unless you have explicitly turned on auto-send for a source you trust. You are always the final word in your own inbox.",
  },
  {
    q: "Is there a free trial?",
    a: "No — you subscribe to activate. Pick a plan, and the engine switches on: it starts answering your inquiries in your voice and hunting venues right away. It's month-to-month, cancel anytime in two clicks, and at your monthly cap we pause rather than surprise-bill you.",
  },
];

const faqJsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQS.map((f) => ({
    "@type": "Question",
    name: f.q,
    acceptedAnswer: { "@type": "Answer", text: f.a },
  })),
};

/** The v2 signature: one gradient-painted word in a warm-white/ink headline. */
const GRAD = "bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent";

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      aria-hidden="true"
      className="mt-0.5 h-5 w-5 shrink-0 text-brand-cyan"
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

export default function PricingPage() {
  return (
    <div className="relative isolate overflow-hidden bg-ink-stage text-cream-bright">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd).replace(/</g, "\\u003c"),
        }}
      />

      {/* one ring pattern per page (LAW) + soft neon vignettes, hero only */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[44rem]">
        <RingsBackdrop />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(640px circle at 78% 200px, rgba(255,45,174,0.10), transparent 70%), radial-gradient(520px circle at 8% 60px, rgba(255,138,0,0.07), transparent 70%)",
          }}
        />
      </div>

      <section className="relative max-w-6xl mx-auto px-6 pt-16 sm:pt-24 pb-12 text-center">
        <StickerChip tone="cream" rotate={-2}>
          Pricing
        </StickerChip>
        <h1 className="mt-6 text-4xl sm:text-6xl font-black tracking-tight text-cream-bright text-balance">
          Less than one good <span className={GRAD}>gig</span>. The whole engine,
          every plan.
        </h1>
        <p className="mt-6 max-w-2xl mx-auto text-lg leading-relaxed text-cream/70">
          Bright Ears hunts the web for venues that fit you and drafts the
          outreach in your voice — and it answers every inquiry that comes in too.
          A booked event is often worth $1,500–3,000; this costs less than a
          dinner out. Subscribe to activate, cancel anytime.
        </p>
        <p className="mt-4 max-w-2xl mx-auto text-sm font-semibold text-cream/90">
          Every plan is the complete engine — the Hunt that finds venues for you
          AND answers every inquiry in your voice, with follow-ups until
          booked-or-dead, a weekly report, Travel Mode, spam filtering and
          approve-from-phone, and the same deep research on every plan. You only
          choose how many inquiries, how many cities and how much autopilot.
        </p>
      </section>

      {/* plan cards — cream posters on the ink stage; Pro elevated, magenta ring */}
      <section className="relative max-w-6xl mx-auto px-6 pb-16 pt-4">
        <div className="grid gap-8 lg:grid-cols-3 lg:items-stretch">
          {PLANS.map((plan, i) => (
            <div
              key={plan.name}
              className={`relative flex ${plan.highlighted ? "lg:-my-3" : ""}`}
            >
              {plan.highlighted && (
                <GradientBlob tone="show" className="-bottom-8 -right-6 h-44 w-60" />
              )}
              <div
                className={`relative flex w-full flex-col rounded-3xl bg-cream p-7 pb-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)] ${
                  plan.highlighted
                    ? "ring-2 ring-neon-magenta lg:py-10"
                    : i === 0
                      ? "-rotate-1"
                      : "rotate-1"
                }`}
              >
                {plan.highlighted && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <StickerChip tone="magenta" rotate={-3}>
                      Most popular
                    </StickerChip>
                  </span>
                )}
                <h2 className="font-mono text-xs font-bold uppercase tracking-[0.18em] text-ink-stage/60">
                  {plan.name}
                </h2>
                <div className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-5xl font-black tracking-tight text-ink-stage">
                    {plan.price}
                  </span>
                  <span className="text-ink-stage/50">/month</span>
                </div>
                <p className="mt-3 text-sm text-ink-stage/70">{plan.blurb}</p>
                <ul className="mt-6 space-y-3 text-sm text-ink-stage/80 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <CheckIcon />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  // The chosen plan rides the whole funnel (P5.5): sign-up →
                  // wizard → the step-5 finale opens checkout for THIS plan,
                  // so nobody re-decides at the activation moment.
                  href={`/onboarding?plan=${plan.name.toLowerCase()}`}
                  className={`mt-8 block rounded-full text-center font-bold px-4 py-3 transition-opacity ${
                    plan.highlighted
                      ? "bg-neon-magenta text-white shadow-[0_8px_28px_rgba(255,45,174,0.35)] hover:opacity-90"
                      : "border-[1.5px] border-ink-stage/30 text-ink-stage/80 hover:border-ink-stage/60 hover:text-ink-stage transition-colors"
                  }`}
                >
                  Get started
                </Link>
                <p className="mt-3 text-center text-xs text-ink-stage/50">
                  Subscribe to activate · cancel anytime
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Outcome math + risk-reversal (ADR-003: per-gig economics as framing + the subscribe-to-activate line) */}
      <section className="relative max-w-6xl mx-auto px-6 pb-12">
        <div className="relative overflow-hidden rounded-3xl bg-ink-raised border border-cream/10 p-8 sm:p-10 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-cream-bright">
            The outcome math
          </h2>
          <div className="mx-auto mt-8 grid max-w-3xl gap-10 sm:grid-cols-2">
            <div>
              <div
                aria-hidden
                className="mx-auto h-1 w-10 rounded-full"
                style={{ background: "linear-gradient(90deg, #ff2dae, #ff8a00)" }}
              />
              <p className={`mt-4 text-5xl font-black tracking-tight ${GRAD}`}>$1,800</p>
              <p className="mt-3 text-sm leading-relaxed text-cream/65">
                One saved example $1,800 booking (illustrative) pays for{" "}
                <strong className="text-cream-bright">6 years of Starter</strong>.
              </p>
            </div>
            <div>
              <div
                aria-hidden
                className="mx-auto h-1 w-10 rounded-full"
                style={{ background: "linear-gradient(90deg, #ff2dae, #ff8a00)" }}
              />
              <p className={`mt-4 text-5xl font-black tracking-tight ${GRAD}`}>~$1.67</p>
              <p className="mt-3 text-sm leading-relaxed text-cream/65">
                Per lead handled — one raw Bark lead costs{" "}
                <strong className="text-cream-bright">$28–47</strong>, and you
                still have to answer it yourself.
              </p>
            </div>
          </div>
          <p className="mt-8 inline-block rounded-full bg-cream-bright px-5 py-2.5 text-sm font-bold text-ink-stage">
            {RISK_REVERSAL.short}
          </p>
        </div>
      </section>

      <section className="relative max-w-6xl mx-auto px-6 pb-24">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-3xl bg-cream p-6 shadow-[0_18px_44px_rgba(0,0,0,0.4)] -rotate-1">
            <h3 className="font-bold text-ink-stage">
              Busy month? Upgrade, not lock-in.
            </h3>
            <p className="mt-2 text-sm text-ink-stage/70">
              Busy-season spikes are real — wedding months, festival runs, a
              corporate Q4. Move up a plan in one click to answer more inquiries
              each month, and step back down whenever the rush passes.
              Month-to-month, no commitment.
            </p>
          </div>
          <div className="rounded-3xl bg-cream p-6 shadow-[0_18px_44px_rgba(0,0,0,0.4)] rotate-1">
            <h3 className="font-bold text-ink-stage">
              At your cap, drafting pauses — never surprise bills.
            </h3>
            <p className="mt-2 text-sm text-ink-stage/70">
              When you hit your monthly cap, we pause and ask before anything
              costs you a cent. Your card is never charged for overages you
              didn&apos;t choose.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ — on ink, cream cards */}
      <section className="relative max-w-3xl mx-auto px-6 pb-24">
        <div className="text-center">
          <StickerChip tone="cream" rotate={2}>
            FAQ
          </StickerChip>
          <h2 className="mt-5 text-3xl sm:text-4xl font-black tracking-tight text-cream-bright">
            Fair questions, <span className={GRAD}>straight</span> answers
          </h2>
          <p className="mt-3 text-cream/65">
            The things performers actually ask us before they forward their
            first lead.
          </p>
        </div>
        <div className="mt-10 space-y-4">
          {FAQS.map((f) => (
            <div key={f.q} className="rounded-2xl bg-cream p-6">
              <h3 className="font-bold text-ink-stage">{f.q}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-stage/70">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* closing CTA — cream poster with collage, the design/b hero echo */}
      <section className="relative max-w-6xl mx-auto px-6 pb-20">
        <div className="relative">
          <GradientBlob tone="show" className="-bottom-9 left-12 h-40 w-80" />
          <div className="relative overflow-hidden rounded-3xl bg-cream px-8 py-12 sm:py-16 text-center shadow-[0_30px_80px_rgba(0,0,0,0.5)] rotate-[-0.6deg]">
            <HaloRing width={320} height={116} tilt={-12} className="left-1/2 top-8 -ml-40" />
            <VinylDisc size={180} tone="orange" spin className="-bottom-14 -right-12" />
            <span aria-hidden className="absolute left-[14%] top-10 text-2xl text-ink-stage/25">
              &#10022;
            </span>
            <h2 className="relative text-3xl sm:text-4xl font-black tracking-tight text-ink-stage text-balance">
              Never miss a <span className={GRAD}>gig</span> you never knew existed.
            </h2>
            <p className="relative mt-4 text-ink-stage/70 max-w-xl mx-auto">
              It finds the rooms, drafts the pitch, you just approve. Subscribe to
              activate. Cancel anytime.
            </p>
            <Link
              href="/onboarding"
              className="relative mt-8 inline-block rounded-full bg-neon-magenta px-8 py-3.5 text-base font-bold text-white shadow-[0_10px_36px_rgba(255,45,174,0.45)] hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
