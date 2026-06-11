import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/copy-button";
import { GradientBlob, RingsBackdrop, StickerChip, VinylDisc } from "@/components/collage";

export const metadata: Metadata = {
  title: "25 Wedding DJ Inquiry & Follow-Up Templates (Free) — Bright Ears",
  description:
    "Copy-paste email templates for wedding and event DJs: first replies for every inquiry type, day 2/5/9 follow-ups, contract and deposit nudges, review asks, rebooking and referrals. Free, no PDF, no paywall.",
};

/* One gradient-painted word in the headline — the design/b signature. */
const gradText: CSSProperties = {
  background: "linear-gradient(92deg, #ff2dae 5%, #ff8a00 95%)",
  WebkitBackgroundClip: "text",
  backgroundClip: "text",
  color: "transparent",
};

type Template = {
  title: string;
  useWhen: string;
  subject?: string; // omitted = send as a reply in the same thread
  body: string;
  tip?: string;
};

type Section = {
  id: string;
  heading: string;
  blurb: string;
  accent: "cream" | "magenta";
  templates: Template[];
};

const SECTIONS: Section[] = [
  {
    id: "first-replies",
    heading: "First replies",
    blurb:
      "Speed wins. Couples book whoever replies first — a short, specific reply in 5 minutes beats a perfect one in 5 hours. Every template here names their date and venue, answers what they actually asked, and ends with ONE clear next step.",
    accent: "cream",
    templates: [
      {
        title: "Wedding inquiry — your date is open",
        useWhen: "A real wedding inquiry arrives and you're free on the date.",
        subject: "Your wedding at [venue] — yes, [date] is open!",
        body: `Hi [Name] — congratulations, and thanks for reaching out!

Good news: [date] is open on my calendar, and I love working at [venue]. For [guest count] guests, most couples go with my [package name] — [price range] — which covers ceremony sound, MC duties, and the reception from first dance to last song.

Two quick questions so I can send an exact quote: what time does the reception wrap, and is the ceremony on site?

Happy to jump on a quick call this week if that's easier — grab a time here: [scheduling link].

[Your name]`,
        tip: "Specifics beat polish. Naming their venue and date proves a human actually read their message.",
      },
      {
        title: "You're already booked on their date",
        useWhen: "You can't take the gig — turn the 'no' into goodwill and referrals.",
        subject: "[Date] — I'm booked, but don't panic",
        body: `Hi [Name] — congratulations on the engagement!

I have to be straight with you: I'm already committed on [date]. I hate sending this email, because a wedding at [venue] sounds like a great party.

If it helps, two DJs I'd trust with my own reputation are [DJ name] ([link]) and [DJ name] ([link]) — tell them I sent you.

And if anything about your date changes, I'd love to hear from you first.

Have an amazing wedding,
[Your name]`,
        tip: "Referral generosity comes back around — those DJs return the favor on dates THEY'RE booked.",
      },
      {
        title: "The price shopper — \"how much do you charge?\"",
        useWhen: "The entire inquiry is a price question.",
        subject: "Pricing for [date] — and exactly what's included",
        body: `Hi [Name] — thanks for asking, and happy to be upfront.

Most weddings I do land between [$low] and [$high], depending on hours, ceremony sound, and lighting. The middle of that range covers [X] hours of reception, MC duties, and a planning session so the music actually sounds like you.

Tell me your date, venue, and rough guest count and I'll send an exact number — no games, no "call me for pricing."

[Your name]`,
        tip: "Answer the question. Dodging price reads as both expensive AND evasive; a real range with inclusions builds trust.",
      },
      {
        title: "Just engaged — no date yet",
        useWhen: "They're excited but haven't picked a date.",
        subject: "No date yet? You're early — that's a good thing",
        body: `Hi [Name] — congratulations! And no stress about not having a date: you're ahead of the game, not behind it.

One thing worth knowing while you narrow it down: Saturdays in [peak months] book first — mine usually go 9–12 months out. The moment you have two or three candidate dates, send them over and I'll tell you which ones I can hold.

Meanwhile: what's the vibe you're imagining? Packed dance floor all night? Cocktail-party cool? I like to start there.

[Your name]`,
        tip: "Useful date intelligence keeps the conversation alive without any pressure.",
      },
      {
        title: "Directory lead with almost no details",
        useWhen: "A The Knot / WeddingWire lead arrives with a date and nothing else.",
        subject: "Your inquiry — quick yes on [date]",
        body: `Hi [Name] — thanks for finding me on [The Knot]! Short version: [date] is open as of right now.

To send you a real quote instead of a form letter, I just need three things: your venue (or city), rough guest count, and how many hours of music you're picturing.

Reply here — or if it's faster, text me at [number]. Either way you'll hear back from me today.

[Your name]`,
        tip: "Directory couples message several vendors at once. Be the one who answers first with a direct next step.",
      },
      {
        title: "Corporate event inquiry",
        useWhen: "A company or planner asks about a corporate party.",
        subject: "DJ for [company]'s [event] on [date] — availability + pricing",
        body: `Hi [Name] — thanks for reaching out about your [event type] on [date]. Yes, I'm available.

For corporate events I run [X] hours with full sound, wireless mics for speeches, and music matched to the room — background through dinner, party after. That package is [$X]; uplighting adds [$Y].

I can send a one-page quote plus my W-9 and certificate of insurance today — most venues ask for those anyway. Who should I address the quote to?

[Your name]`,
        tip: "Offering the W-9 and COI unprompted tells a corporate buyer you've done this before.",
      },
      {
        title: "Last-minute booking (a few weeks out)",
        useWhen: "The event is soon and they need an answer fast.",
        subject: "[Date] — yes, I can make this work",
        body: `Hi [Name] — short notice doesn't scare me; some of my favorite events came together in two weeks.

I'm open on [date]. Given the timeline, here's how I'd run it: a 30-minute planning call this week, my standard [package] at [$X], contract and deposit by [day] to lock everything in.

If you can do a quick call today or tomorrow, I'll hold the date until then. What time works?

[Your name]`,
        tip: "Urgency wants decisiveness, not a menu. Propose one clear plan with a deadline.",
      },
      {
        title: "Their budget is below your minimum",
        useWhen: "They've named a number you can't work for.",
        subject: "About your budget — an honest answer",
        body: `Hi [Name] — thanks for being upfront about the [$X] budget. Honest answer back: my weddings start at [$Y], and I'd rather tell you straight than quote high and disappear.

If there's flexibility, [$Y] gets you [what's included] — and I earn it on the dance floor.

If the budget's firm, that's genuinely okay. Whoever you talk to, ask two questions: will THEY personally be your DJ, and do they bring backup gear? Those two filter out most bad wedding nights.

Either way — congrats, and happy planning!
[Your name]`,
        tip: "Some below-budget leads stretch when treated with respect. The rest remember you — and refer friends who can pay.",
      },
      {
        title: "Birthday or private party",
        useWhen: "A non-wedding private event inquiry.",
        subject: "Your party on [date] — let's do it",
        body: `Hi [Name] — a [occasion] for [guest count] people sounds like a blast, and [date] is open.

Private parties run [$X] for [X] hours, with sound, party lighting, and live requests handled on the fly — I read rooms for a living, so your friends will think you hired a mind-reader.

The thing that shapes the night most: what music does the guest of honor actually love? Give me three artists and I'm already planning.

[Your name]`,
      },
      {
        title: "The one-liner — \"are you available?\"",
        useWhen: "The whole message is one sentence.",
        subject: "Yes — [date] is open. Quick details?",
        body: `Hi [Name] — yes, [date] is open as of today!

So I can quote you properly: what type of event, where (venue or city), and roughly how many guests?

Fastest route is a quick call — grab any slot here: [scheduling link]. Until then, consider yourself penciled in.

[Your name]`,
        tip: "Match their energy: short question, short answer, one clear next step.",
      },
    ],
  },
  {
    id: "follow-ups",
    heading: "Follow-ups",
    blurb:
      "\"Get an inquiry, immediately respond, and then nothing.\" Sound familiar? Most gigs are won on the follow-up — day 2, day 5, day 9, then stop. Send these as replies in the same email thread so the whole conversation stays in front of them.",
    accent: "magenta",
    templates: [
      {
        title: "Day 2 — the gentle bump",
        useWhen: "Two days of silence after your first reply.",
        body: `Hi [Name] — just floating my note from [day] back to the top of your inbox. Wedding planning means forty open tabs; I get it.

[Date] is still open on my end. Any questions I can answer — about music, timeline, or anything you're stuck on?

[Your name]`,
        tip: "Two days is the sweet spot: present, not pushy. Blame the inbox, never the person.",
      },
      {
        title: "Day 5 — add value, don't just \"check in\"",
        useWhen: "Still quiet. Give them something useful instead of another nudge.",
        body: `Hi [Name] — while you're comparing DJs (smart — you should), here's the one question I'd ask every single one of us: "Who exactly will be performing at MY wedding?" Larger companies sometimes send whoever's free that night.

My answer is simple: you book me, you get me.

Happy to answer that or anything else — and [date] is still open.

[Your name]`,
        tip: "Teach them how to shop. The vendor who educates feels like the safe choice.",
      },
      {
        title: "Day 9 — the graceful close",
        useWhen: "Final scheduled follow-up. Close the loop with zero guilt.",
        body: `Hi [Name] — last note from me, promise. Silence usually means you've found your DJ (congrats!) or life got loud for a while (relatable).

So I won't keep nudging. If [date] is still unspoken for and you want it, reply "still interested" anytime and I'll tell you honestly whether it's open.

Whatever you decide, have an incredible wedding.
[Your name]`,
        tip: "A clean close earns respect — and \"reply anytime\" makes resurrections easy. They happen more than you'd think.",
      },
      {
        title: "You sent a quote — then silence",
        useWhen: "The quote went out 3–4 days ago with no response.",
        body: `Hi [Name] — checking in on the quote I sent [day]. Two quick things, in case either is the holdup:

1. Nothing in it is set in stone — if the package isn't quite right, tell me what to add or trim.
2. The date stays first-come, first-served until a contract is signed — I'd hate for an email gap to cost you [date].

What questions can I answer?

[Your name]`,
      },
      {
        title: "After a call — recap and next step",
        useWhen: "You just got off the phone and want to lock momentum in writing.",
        body: `Hi [Name] — great talking today! Quick recap so nothing lives only in my head:

— [Date] at [venue], roughly [guest count] guests
— [X] hours, ceremony sound included, leaning toward [package]
— Must-play: [song]. Do-not-play: [genre]. (Noted forever.)

Next step: I'll send the contract and the [$X] retainer link tonight. The date is officially yours once both are done.

Excited for this one,
[Your name]`,
        tip: "Same-day recaps convert. Momentum is a perishable good.",
      },
      {
        title: "\"We need to think about it\"",
        useWhen: "They're hesitating between you and someone else.",
        body: `Hi [Name] — of course. Take the time you need; it's a big decision.

One thing that might help: the most common regret I hear from couples is botched announcements and an empty dance floor. So whoever you choose, ask to see real footage from a real wedding — not a promo reel. Mine's here: [link].

I'll check back in a week unless I hear from you sooner. [Date] is still open as of today.

[Your name]`,
      },
      {
        title: "Another couple asked about their date",
        useWhen: "ONLY when it's actually true — honest scarcity, never invented.",
        body: `Hi [Name] — a heads-up I'd want if I were you: another couple just asked about [date].

You inquired first, so you hear it first. I'm not going to invent a fake deadline — but if you're leaning toward booking, now's the moment to say so, and I'll hold the date for [48 hours] while we do the paperwork.

If you've gone another direction, no hard feelings — tell me and I'll free it up.

[Your name]`,
        tip: "Scarcity only works — and is only okay — when it's real. Used honestly, it's the strongest email on this page.",
      },
      {
        title: "Reviving a lead that went cold months ago",
        useWhen: "60–90 days of silence, their event date is still ahead.",
        subject: "Still looking for a DJ for [date]?",
        body: `Hi [Name] — you reached out a while back about your [event] on [date], and we lost touch. Usually that means planning got intense for a stretch.

I still have the date open, so I wanted to check in once before [season] booking really picks up. If you're all sorted — wonderful, ignore me! If not, my earlier quote still stands and I can have you locked in this week.

Either way, happy planning!
[Your name]`,
      },
    ],
  },
  {
    id: "booking-and-money",
    heading: "Booking, money & the big day",
    blurb:
      "The inquiry was the easy part. These keep the paperwork moving, the deposit landing, and the final details locked — without you chasing anyone at midnight.",
    accent: "cream",
    templates: [
      {
        title: "Sending the contract",
        useWhen: "They said yes — make signing frictionless.",
        subject: "Your contract for [date] — two clicks and it's official",
        body: `Hi [Name] — here it is: [contract link].

The 60-second version: [package] on [date] at [venue], [$total] total, [$X] retainer now, balance due [when]. Backup equipment is always on site, and if I'm somehow out of commission, my emergency coverage network takes your date — it's in writing, clause [n].

Signature + retainer = date locked. Then the fun part starts: planning the actual music.

[Your name]`,
      },
      {
        title: "Deposit reminder",
        useWhen: "Contract signed, retainer still outstanding.",
        body: `Hi [Name] — the contract's signed (thank you!), so just the [$X] retainer left to make [date] officially, permanently yours: [payment link].

Until it lands, I technically can't turn other couples away from your date — and I'd really like to.

Two clicks: [payment link]

[Your name]`,
      },
      {
        title: "Final details check-in (two weeks out)",
        useWhen: "Fourteen days before the event.",
        body: `Hi [Name] — two weeks! Time to lock the details. Can you confirm:

1. Final timeline — ceremony, cocktails, entrances, first dance, last song
2. Names and pronunciations for announcements — spell them how they SOUND
3. Must-plays, do-not-plays, and the do-not-play-even-if-grandma-asks list
4. A day-of contact who isn't you (you'll be busy getting married)

Fifteen minutes now buys a flawless night. A quick call works too: [scheduling link].

[Your name]`,
        tip: "Asking for a day-of contact quietly signals you've done this a hundred times.",
      },
      {
        title: "The day-after thank you",
        useWhen: "The morning after the event, while the glow is real.",
        body: `Hi [Name] — still riding the high from last night. The whole room on the floor for [last song / a specific moment] is going straight into my favorite-weddings file.

Thank you for trusting me with the biggest party of your life.

Go enjoy being married — I'll be in touch in a few days with one tiny favor to ask.

[Your name]`,
        tip: "Sets up the review ask before you make it — and it's just a good thing to send.",
      },
    ],
  },
  {
    id: "reviews-and-rebooking",
    heading: "Reviews, rebooking & referrals",
    blurb:
      "The booking after the booking. Reviews bring the next couple, corporate gigs renew annually, and happy clients know other people planning parties — if you ask.",
    accent: "magenta",
    templates: [
      {
        title: "The review ask (about a week after)",
        useWhen: "5–10 days post-event, while the memory is vivid.",
        subject: "One small favor (takes three minutes)",
        body: `Hi [Name] — hope week one of married life is treating you well!

Small favor: reviews are how couples like you found me in the first place. If you've got three minutes, would you share a few words about the night? [Review link — one link only]

Mentioning a specific moment — the packed floor during [song], the ceremony audio, the announcements — helps future couples more than star ratings do.

Thank you! And you know where I am for the anniversary parties.
[Your name]`,
        tip: "One link, one ask, within two weeks. Prompting for a specific moment produces the reviews that book the next couple.",
      },
      {
        title: "Rebooking an annual event",
        useWhen: "Corporate or recurring clients, 9–10 months after last year's event.",
        subject: "Same time next year? [Month] is filling up already",
        body: `Hi [Name] — last year's [event] is still one of my favorite gigs ([specific detail — the CFO leading the conga line stays with me]).

I'm starting to book [month] now, so I wanted to give [company] first claim before the date goes. Last year's package holds at [$X] if we confirm by [date] — and I still have your run-of-show, announcements, and playlist notes on file, so setup is zero work for you.

Shall I pencil you in?
[Your name]`,
        tip: "\"I still have your notes on file\" is the quiet killer line — switching away from you becomes the expensive option.",
      },
      {
        title: "The referral ask",
        useWhen: "A couple of months after a wedding that went great.",
        subject: "Know anyone getting married?",
        body: `Hi [Name] — quick one. Most of my favorite weddings come from past couples, not ads — and statistically, your friend group is full of newly engaged people right now.

If anyone's hunting for a DJ, an intro means the world: just forward this email or pass along [your site]. As a thank-you, any friend you send gets [perk], and you get first claim on me for the anniversary parties — friends-and-family rate, obviously.

Hope married life is wonderful,
[Your name]`,
      },
    ],
  },
];

const FAQS = [
  {
    q: "How fast should a DJ reply to a wedding inquiry?",
    a: "Within five minutes if you possibly can, and within the hour at worst. Couples typically message several vendors at once and shortlist whoever responds first — about a third of vendors never reply at all, so speed alone puts you ahead of the pack. A short, specific reply sent fast beats a perfect reply sent that evening.",
  },
  {
    q: "How many times should I follow up on a DJ inquiry?",
    a: "Three follow-ups after your first reply is the sweet spot: a gentle bump on day 2, something genuinely useful on day 5, and a graceful close on day 9. Then stop — and leave the door open for them to come back. Most bookings that were ever going to happen surface inside that window.",
  },
  {
    q: "Should I put my DJ prices in the first reply?",
    a: "Give a real range with what's included, even if you don't quote an exact figure until you know the details. \"Call for pricing\" reads as both expensive and evasive, and price-shoppers simply move on to the next DJ who answers the question.",
  },
  {
    q: "Can these templates be automated?",
    a: "Yes — that's literally why we built Bright Ears. It watches your inbox and lead sources, drafts replies like these in your own voice with your real availability and rates, sends you a push notification, and you approve from your phone. Follow-ups run on the day 2/5/9 cadence automatically until the gig is booked or dead. Median first reply: under five minutes.",
  },
];

/** Highlight [placeholders] so the eye can find what to personalize. */
function renderBody(body: string): ReactNode[] {
  return body.split(/(\[[^\]]+\])/g).map((part, i) =>
    part.startsWith("[") && part.endsWith("]") ? (
      <span key={i} className="rounded bg-brand-cyan-soft px-1 font-medium text-ink-stage">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function TemplateCard({ t, number }: { t: Template; number: number }) {
  const tilt = number % 2 ? "-rotate-[0.4deg]" : "rotate-[0.4deg]";
  return (
    <article
      id={`template-${number}`}
      className={`rounded-3xl bg-cream shadow-[0_18px_44px_rgba(0,0,0,0.4)] overflow-hidden ${tilt}`}
    >
      <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5">
        <div>
          <h3 className="font-extrabold tracking-tight text-ink-stage">
            <span className="text-neon-magenta mr-2">{number}.</span>
            {t.title}
          </h3>
          <p className="text-xs text-ink-stage/55 mt-1">
            <span className="font-semibold">Use when:</span> {t.useWhen}
          </p>
        </div>
        <CopyButton text={t.body} />
      </div>
      <div className="px-5 sm:px-6 py-4">
        <div className="rounded-xl bg-cream-bright border border-ink-stage/10 p-4 sm:p-5">
          {t.subject ? (
            <p className="text-sm mb-3 pb-3 border-b border-ink-stage/10">
              <span className="font-semibold text-ink-stage/45">Subject: </span>
              <span className="font-semibold text-ink-stage">{renderBody(t.subject)}</span>
            </p>
          ) : (
            <p className="text-xs mb-3 pb-3 border-b border-ink-stage/10 text-ink-stage/45 italic">
              Send as a reply in the same email thread — keep the conversation in one place.
            </p>
          )}
          <p className="text-sm leading-relaxed whitespace-pre-line text-ink-stage/85">
            {renderBody(t.body)}
          </p>
        </div>
        {t.tip && (
          <p className="text-xs text-ink-stage/60 mt-3">
            <span className="font-semibold text-ink-stage">Why it works: </span>
            {t.tip}
          </p>
        )}
      </div>
    </article>
  );
}

function StartFreeBanner({ heading, sub }: { heading: string; sub: string }) {
  return (
    <div className="relative">
      <GradientBlob tone="show" className="-bottom-8 left-10 h-36 w-72" />
      <div className="relative overflow-hidden rounded-3xl bg-cream p-7 sm:p-9 text-center shadow-[0_30px_80px_rgba(0,0,0,0.5)] rotate-[-0.6deg]">
        <VinylDisc size={120} tone="dark" className="-bottom-12 -right-10" />
        <h2 className="relative text-xl sm:text-2xl font-extrabold tracking-tight text-ink-stage mb-3">
          {heading}
        </h2>
        <p className="relative text-ink-stage/65 text-sm max-w-xl mx-auto mb-6">{sub}</p>
        <Link
          href="/onboarding"
          className="relative inline-block rounded-full bg-neon-magenta text-white font-bold px-7 py-3 shadow-[0_10px_36px_rgba(255,45,174,0.45)] hover:opacity-90 transition-opacity"
        >
          Start free
        </Link>
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  let counter = 0;
  const numbered = SECTIONS.map((section) => ({
    ...section,
    templates: section.templates.map((t) => ({ t, number: ++counter })),
  }));

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  return (
    <div className="relative isolate overflow-hidden bg-ink-stage text-cream-bright">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
      />

      {/* one ring pattern per page + soft neon vignette */}
      <RingsBackdrop />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(640px circle at 80% 200px, rgba(255,45,174,0.1), transparent 70%), radial-gradient(520px circle at 6% 80px, rgba(255,138,0,0.07), transparent 70%)",
        }}
      />

      {/* Hero */}
      <section className="relative">
        <div className="relative max-w-3xl mx-auto px-6 pt-16 sm:pt-24 pb-12 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-cream/25 bg-cream/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-cream/75">
            <span className="h-1.5 w-1.5 rounded-full bg-neon-magenta" />
            Free — no PDF, no paywall, just copy and send
          </span>
          <h1 className="mt-7 text-4xl sm:text-6xl font-black tracking-tight leading-[1.02]">
            25 Wedding DJ Inquiry &amp; Follow-Up <span style={gradText}>Templates</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-cream/65">
            &ldquo;Get an inquiry, immediately respond, and then nothing.&rdquo; We&apos;ve run an
            entertainment business for 20 years — these are the emails that actually get answered.
            First replies for every situation, follow-ups that don&apos;t feel desperate, and the
            asks most DJs never send.
          </p>
        </div>
      </section>

      {/* Ground rules — cream poster */}
      <section className="relative max-w-3xl mx-auto px-6 pb-12">
        <div className="relative">
          <GradientBlob tone="show" className="-bottom-7 -left-6 h-32 w-56" />
          <div className="relative overflow-hidden rounded-3xl bg-cream p-6 sm:p-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)] rotate-[-0.5deg]">
            <h2 className="font-extrabold tracking-tight text-ink-stage text-lg mb-4">
              Three rules that matter more than any template
            </h2>
            <ol className="space-y-3 text-sm text-ink-stage/75 leading-relaxed list-none">
              <li className="flex gap-3">
                <span className="shrink-0 h-6 w-6 rounded-full bg-brand-cyan-soft text-ink-stage font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <span>
                  <strong className="text-ink-stage">Reply in the first 5 minutes.</strong> Couples
                  book whoever replies first, and roughly a third of vendors never reply at all. A
                  short answer now beats a perfect one tonight.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 h-6 w-6 rounded-full bg-[#ffd6ec] text-[#9c0f63] font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <span>
                  <strong className="text-ink-stage">Personalize the brackets — always.</strong>{" "}
                  Their name, their date, their venue. One specific detail proves a human read their
                  message; zero details reads as an autoresponder.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="shrink-0 h-6 w-6 rounded-full bg-[#ffdfba] text-[#7a4100] font-bold text-xs flex items-center justify-center">
                  3
                </span>
                <span>
                  <strong className="text-ink-stage">
                    Follow up day 2, day 5, day 9 — then stop.
                  </strong>{" "}
                  Most gigs are won on the follow-up, and almost none after the third. Close
                  gracefully and leave the door open.
                </span>
              </li>
            </ol>
          </div>
        </div>

        {/* TOC — ghost pills on ink (cyan = clickable) */}
        <nav aria-label="Template sections" className="mt-10 flex flex-wrap gap-2 justify-center">
          {numbered.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-full border-[1.5px] border-cream/30 text-sm font-semibold text-cream/80 px-4 py-2 hover:border-brand-cyan hover:text-brand-cyan transition-colors"
            >
              {s.heading}{" "}
              <span className="text-cream/40 font-normal">({s.templates.length})</span>
            </a>
          ))}
        </nav>
      </section>

      {/* Sections — the poster wall */}
      <div className="relative max-w-5xl mx-auto px-6 space-y-20 pb-20">
        {numbered.map((section, idx) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <div className="mb-8 max-w-3xl">
              <StickerChip tone={section.accent} rotate={idx % 2 ? 2 : -2} className="mb-3">
                Part {idx + 1}
              </StickerChip>
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-cream-bright mb-3">
                {section.heading}
              </h2>
              <p className="text-cream/60 leading-relaxed">{section.blurb}</p>
            </div>
            <div className="grid gap-6 sm:grid-cols-2 items-start">
              {section.templates.map(({ t, number }) => (
                <TemplateCard key={number} t={t} number={number} />
              ))}
            </div>
            {/* Mid-page bridge after the follow-ups section */}
            {section.id === "follow-ups" && (
              <div className="mt-12 max-w-3xl mx-auto">
                <StartFreeBanner
                  heading="Sending these at 11pm after a gig? There's a better way."
                  sub="Bright Ears drafts every first reply and runs the day 2/5/9 follow-ups for you — in your voice, with your real availability and rates. You approve from your phone. Median first reply: under 5 minutes. 14-day free trial, no card, from $25/mo."
                />
              </div>
            )}
          </section>
        ))}
      </div>

      {/* FAQ */}
      <section className="relative max-w-5xl mx-auto px-6 pb-20">
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-cream-bright text-center mb-10">
          Quick answers
        </h2>
        <div className="grid gap-6 sm:grid-cols-2 items-start">
          {FAQS.map((f, i) => (
            <div
              key={f.q}
              className={`rounded-3xl bg-cream p-6 shadow-[0_18px_44px_rgba(0,0,0,0.4)] ${
                i % 2 ? "rotate-[0.4deg]" : "-rotate-[0.4deg]"
              }`}
            >
              <h3 className="font-extrabold tracking-tight text-ink-stage mb-2">{f.q}</h3>
              <p className="text-sm text-ink-stage/65 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="relative max-w-3xl mx-auto px-6 pb-24">
        <StartFreeBanner
          heading="If there were two of you, you'd double your business."
          sub="There can be. Bright Ears answers every inquiry in minutes, follows up until booked-or-dead, and filters the spam before you ever see it — while your clients only ever see you. Try it free for 14 days, no card."
        />
        <p className="text-center text-sm text-cream/50 mt-10">
          More free tools:{" "}
          <Link
            href="/tools/inquiry-reply-generator"
            className="text-brand-cyan font-semibold hover:underline"
          >
            Inquiry reply generator
          </Link>{" "}
          ·{" "}
          <Link
            href="/tools/lead-roi-calculator"
            className="text-brand-cyan font-semibold hover:underline"
          >
            Lead ROI calculator
          </Link>
        </p>
      </section>
    </div>
  );
}
