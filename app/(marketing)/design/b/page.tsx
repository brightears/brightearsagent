import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Bright Ears — Design Direction B: Neon Collage",
  robots: { index: false },
};

/* ------------------------------------------------------------------ */
/* Direction B — "Neon Collage"                                        */
/* Dark ink-navy canvas; the star is cream gallery-poster panels       */
/* carrying CSS collage art (vinyl + speaker + halo), one gradient     */
/* blob underneath each. Headline solid warm white, ONE gradient word. */
/* Solid magenta pill primary + cream-outline ghost.                   */
/* ------------------------------------------------------------------ */

const css = `
  /* Hide the shared marketing chrome so this design preview stands alone */
  div:has(> main .bneon) > header,
  div:has(> main .bneon) > footer { display: none; }

  .bneon-rings {
    background:
      repeating-radial-gradient(circle at 74% 280px, transparent 0 84px, rgba(232,228,220,0.055) 84px 85.5px),
      repeating-radial-gradient(circle at 8% 1500px, transparent 0 104px, rgba(232,228,220,0.04) 104px 105.5px);
  }

  .bneon-grad-text {
    background: linear-gradient(92deg, #ff2dae 5%, #ff8a00 95%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }

  .bneon-spin { animation: bneon-rotate 36s linear infinite; }
  @keyframes bneon-rotate { to { transform: rotate(360deg); } }
`;

/* --- collage primitives (pure CSS, no assets) ---------------------- */

function Blob({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`absolute rounded-full blur-2xl ${className}`}
      style={{ background: "linear-gradient(120deg, #ff2dae 15%, #ff8a00 85%)", opacity: 0.5 }}
    />
  );
}

function Vinyl({
  size,
  tone = "dark",
  spin = false,
  className = "",
}: {
  size: number;
  tone?: "dark" | "orange";
  spin?: boolean;
  className?: string;
}) {
  const label = Math.round(size * 0.36);
  const hole = Math.max(6, Math.round(size * 0.06));
  const grooves =
    tone === "orange"
      ? "repeating-radial-gradient(circle, #df6d00 0 1.5px, #ff8a00 1.5px 3.5px)"
      : "repeating-radial-gradient(circle, #211e29 0 1.5px, #2f2c3a 1.5px 3.5px)";
  return (
    <div aria-hidden className={`absolute ${className}`} style={{ width: size, height: size }}>
      <div
        className={`absolute inset-0 rounded-full ${spin ? "bneon-spin" : ""}`}
        style={{
          background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.2) 0%, rgba(255,255,255,0) 44%), ${grooves}`,
          boxShadow: "0 16px 36px rgba(23,22,31,0.35), inset 0 0 0 1px rgba(23,22,31,0.25)",
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: label,
          height: label,
          background: "#ff2dae",
          boxShadow: "inset 0 0 0 2.5px rgba(23,22,31,0.3)",
        }}
      />
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#e8e4dc]"
        style={{ width: hole, height: hole }}
      />
    </div>
  );
}

function Speaker({
  width,
  height,
  className = "",
}: {
  width: number;
  height: number;
  className?: string;
}) {
  const tweeter = Math.round(width * 0.34);
  const woofer = Math.round(width * 0.7);
  return (
    <div
      aria-hidden
      className={`absolute rounded-2xl ${className}`}
      style={{
        width,
        height,
        background: "linear-gradient(160deg, #2c2935 0%, #1a1922 100%)",
        boxShadow: "0 18px 36px rgba(23,22,31,0.35), inset 0 0 0 1.5px rgba(232,228,220,0.14)",
      }}
    >
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          top: Math.round(height * 0.1),
          width: tweeter,
          height: tweeter,
          border: "3px solid rgba(232,228,220,0.55)",
          background: "radial-gradient(circle at 45% 38%, #514b60 0%, #211e29 70%)",
        }}
      />
      <div
        className="absolute left-1/2 -translate-x-1/2 rounded-full"
        style={{
          bottom: Math.round(height * 0.07),
          width: woofer,
          height: woofer,
          border: "3px solid rgba(232,228,220,0.4)",
          background: "radial-gradient(circle at 50% 42%, #5b5570 0%, #17161f 68%)",
        }}
      />
      <div
        className="absolute rounded-full"
        style={{ top: 10, right: 10, width: 6, height: 6, background: "#ff8a00" }}
      />
    </div>
  );
}

function Halo({
  width,
  height,
  tilt = -14,
  className = "",
}: {
  width: number;
  height: number;
  tilt?: number;
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`absolute rounded-[50%] ${className}`}
      style={{
        width,
        height,
        transform: `rotate(${tilt}deg)`,
        border: "7px solid #fffcf4",
        boxShadow: "0 12px 26px rgba(23,22,31,0.18), inset 0 4px 12px rgba(23,22,31,0.08)",
      }}
    />
  );
}

/* --- cream poster card shell ---------------------------------------- */

function PosterCard({
  emoji,
  title,
  body,
  tilt,
  lift,
  blob,
  children,
}: {
  emoji: string;
  title: string;
  body: string;
  tilt: string;
  lift: string;
  blob: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative ${lift}`}>
      <Blob className={blob} />
      <div
        className={`relative overflow-hidden rounded-3xl bg-[#e8e4dc] p-7 pb-8 shadow-[0_24px_60px_rgba(0,0,0,0.45)] ${tilt}`}
      >
        <div className="relative h-36">{children}</div>
        <h3 className="mt-6 text-xl font-extrabold tracking-tight text-[#17161f]">
          <span className="mr-2">{emoji}</span>
          {title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-[#17161f]/65">{body}</p>
      </div>
    </div>
  );
}

/* --- content --------------------------------------------------------- */

const NAV = ["Pricing", "Compare", "Free tools", "Our story"];

const STATS = [
  { n: "<5 min", l: "first-reply target, once you tap Approve" },
  { n: "~50%", l: "of couples book the first responder" },
  { n: "$1,800", l: "the booking you stop losing" },
];

/* word-by-word magenta -> orange spectrum for the pull quote */
const QUOTE: { w: string; c: string }[] = [
  { w: "“From", c: "#ff2dae" },
  { w: "hello", c: "#ff359e" },
  { w: "to", c: "#ff3e8e" },
  { w: "booked", c: "#ff467e" },
  { w: "—", c: "#ff4f6f" },
  { w: "I", c: "#ff575f" },
  { w: "just", c: "#ff604f" },
  { w: "tap", c: "#ff683f" },
  { w: "Approve", c: "#ff702f" },
  { w: "from", c: "#ff7920" },
  { w: "the", c: "#ff8210" },
  { w: "booth.”", c: "#ff8a00" },
];

export default function DesignDirectionB() {
  return (
    <div className="bneon relative isolate min-h-screen overflow-x-clip bg-[#17161f] font-sans text-[#f6f1e9]">
      <style>{css}</style>

      {/* faint concentric rings + soft neon vignettes */}
      <div aria-hidden className="bneon-rings pointer-events-none absolute inset-0" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(640px circle at 78% 220px, rgba(255,45,174,0.1), transparent 70%), radial-gradient(520px circle at 10% 60px, rgba(255,138,0,0.07), transparent 70%)",
        }}
      />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* nav */}
        <header className="flex items-center justify-between py-7">
          <a href="#" className="flex items-center gap-2.5">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-full"
              style={{ background: "linear-gradient(135deg, #ff2dae, #ff8a00)" }}
            >
              <span className="h-3 w-3 rounded-full border-2 border-[#17161f] bg-[#e8e4dc]" />
            </span>
            <span className="text-lg font-black tracking-tight">Bright Ears</span>
          </a>
          <nav className="flex items-center gap-7 text-sm font-medium text-[#e8e4dc]/65">
            {NAV.map((n) => (
              <a key={n} href="#" className="hidden transition-colors hover:text-[#f6f1e9] sm:inline">
                {n}
              </a>
            ))}
            <a
              href="#"
              className="rounded-full bg-[#ff2dae] px-5 py-2 font-semibold text-white shadow-[0_6px_24px_rgba(255,45,174,0.35)]"
            >
              Start free
            </a>
          </nav>
        </header>

        {/* hero */}
        <section className="pb-24 pt-10">
          <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#e8e4dc]/25 bg-[#e8e4dc]/5 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-[#e8e4dc]/75">
            <span className="h-1.5 w-1.5 rounded-full bg-[#ff2dae]" />
            AI office for DJs &amp; performers
          </span>

          <h1 className="mt-7 max-w-4xl text-7xl font-black leading-[0.95] tracking-tight xl:text-8xl">
            Stop being the <span className="bneon-grad-text">5th</span> DJ to reply
          </h1>

          <div className="mt-12 grid items-center gap-16 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="max-w-xl text-lg leading-relaxed text-[#e8e4dc]/70">
                Every inquiry answered in your voice in under 5 minutes, followed up for days,
                until it&apos;s booked &mdash; you just tap Approve.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-4">
                <a
                  href="#"
                  className="rounded-full bg-[#ff2dae] px-8 py-3.5 text-base font-bold text-white shadow-[0_10px_36px_rgba(255,45,174,0.45)]"
                >
                  Start free
                </a>
                <a
                  href="#"
                  className="inline-flex items-center gap-2.5 rounded-full border-[1.5px] border-[#e8e4dc]/40 px-7 py-3.5 text-base font-semibold text-[#e8e4dc]"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border-[1.5px] border-[#e8e4dc]/50 text-[8px] leading-none">
                    &#9654;
                  </span>
                  Watch the reply write itself
                </a>
              </div>
              <p className="mt-6 text-sm text-[#e8e4dc]/45">
                14-day free trial, no card &middot; setup in minutes
              </p>
            </div>

            {/* hero collage panel — cream poster floating on dark */}
            <div className="relative">
              <Blob className="-bottom-10 -right-8 h-56 w-72" />
              <div className="relative h-[460px] overflow-hidden rounded-3xl bg-[#e8e4dc] shadow-[0_36px_90px_rgba(0,0,0,0.5)] rotate-[1.5deg]">
                {/* chip + sticker */}
                <span className="absolute left-6 top-6 rounded-full border-[1.5px] border-[#17161f]/25 px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#17161f]/70">
                  Now playing &mdash; your reply
                </span>
                <span className="absolute right-6 top-6 rounded-full bg-[#ff2dae] px-3.5 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-white shadow-[0_8px_20px_rgba(255,45,174,0.35)] rotate-[6deg]">
                  Answered in minutes
                </span>

                {/* collage: halo behind, orange vinyl bleeding bottom-left, speaker right */}
                <Halo width={360} height={140} tilt={-13} className="left-6 top-32" />
                <Vinyl size={270} tone="orange" spin className="-bottom-16 -left-12" />
                <Speaker width={150} height={240} className="bottom-10 right-9 rotate-[2.5deg]" />

                {/* sparkles */}
                <span aria-hidden className="absolute left-[52%] top-16 text-2xl text-[#17161f]/30">
                  &#10022;
                </span>
                <span aria-hidden className="absolute bottom-28 left-[46%] text-sm text-[#17161f]/25">
                  &#10022;
                </span>
                <span aria-hidden className="absolute right-44 top-28 text-base text-[#ff2dae]/50">
                  &#10022;
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* stat strip */}
        <section className="border-y border-[#e8e4dc]/10 py-12">
          <div className="grid gap-10 sm:grid-cols-3">
            {STATS.map((s) => (
              <div key={s.n}>
                <div
                  className="h-1 w-10 rounded-full"
                  style={{ background: "linear-gradient(90deg, #ff2dae, #ff8a00)" }}
                />
                <div className="mt-4 text-4xl font-black tracking-tight">{s.n}</div>
                <div className="mt-2 max-w-[220px] text-sm leading-snug text-[#e8e4dc]/55">{s.l}</div>
              </div>
            ))}
          </div>
        </section>

        {/* feature poster grid — the gallery wall */}
        <section className="py-24">
          <div className="grid gap-10 lg:grid-cols-3">
            <PosterCard
              emoji="&#128737;&#65039;"
              title="The scam emails you never see"
              body="Fake &ldquo;urgent wedding deposit&rdquo; requests get caught and filed before they ever reach your phone."
              tilt="-rotate-2"
              lift=""
              blob="-bottom-8 -left-6 h-36 w-52"
            >
              <Halo width={180} height={66} tilt={-12} className="-left-2 top-12" />
              <Speaker width={86} height={132} className="left-8 top-0 -rotate-3" />
              <span className="absolute right-0 top-3 rounded-full bg-[#ff2dae] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-white rotate-[6deg]">
                Marked: scam
              </span>
            </PosterCard>

            <PosterCard
              emoji="&#9997;&#65039;"
              title="Replies in your voice, from your rate card"
              body="Quotes pull from your real rates and packages &mdash; never a generic bot, never a made-up price."
              tilt="rotate-1"
              lift="lg:mt-8"
              blob="-bottom-8 -right-6 h-36 w-52"
            >
              <Vinyl size={132} tone="dark" className="-left-8 top-1" />
              <Halo width={156} height={60} tilt={14} className="right-2 top-16" />
              <span className="absolute right-0 top-2 rounded-full border-[1.5px] border-[#17161f]/30 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#17161f]/70 rotate-[-4deg]">
                Your rate card
              </span>
            </PosterCard>

            <PosterCard
              emoji="&#128200;"
              title="Monday report: leads in, gigs booked"
              body="One email every Monday: who asked, who booked, and what it&apos;s worth."
              tilt="-rotate-1"
              lift="lg:mt-3"
              blob="-bottom-8 -left-6 h-36 w-52"
            >
              <div className="absolute bottom-0 left-3 flex items-end gap-2.5">
                <div
                  className="w-7 rounded-t-full"
                  style={{ height: 44, background: "linear-gradient(180deg, #ff8a00, #ff2dae)" }}
                />
                <div
                  className="w-7 rounded-t-full"
                  style={{ height: 76, background: "linear-gradient(180deg, #ff8a00, #ff2dae)" }}
                />
                <div
                  className="w-7 rounded-t-full"
                  style={{ height: 108, background: "linear-gradient(180deg, #ff8a00, #ff2dae)" }}
                />
              </div>
              <Vinyl size={96} tone="orange" className="-right-5 top-6" />
              <span className="absolute left-1 top-0 rounded-full bg-[#17161f] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[#e8e4dc] rotate-[-5deg]">
                Monday, 9:00
              </span>
            </PosterCard>
          </div>
        </section>

        {/* pull quote on cream, gradient words */}
        <section className="pb-28">
          <div className="relative mx-auto max-w-4xl">
            <Blob className="-bottom-9 left-12 h-40 w-80" />
            <figure className="relative overflow-hidden rounded-[2rem] bg-[#e8e4dc] px-10 py-12 shadow-[0_30px_80px_rgba(0,0,0,0.5)] rotate-[-0.6deg] sm:px-14 sm:py-14">
              <Vinyl size={130} tone="dark" className="-bottom-12 -right-10" />
              <blockquote className="max-w-2xl text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl">
                {QUOTE.map((t, i) => (
                  <span key={i} style={{ color: t.c }}>
                    {t.w}
                    {i < QUOTE.length - 1 ? " " : ""}
                  </span>
                ))}
              </blockquote>
              <figcaption className="mt-7 text-xs font-bold uppercase tracking-[0.18em] text-[#17161f]/55">
                &mdash; how it&rsquo;s meant to feel
              </figcaption>
            </figure>
          </div>
        </section>
      </div>

      {/* tiny footer strip */}
      <footer className="relative border-t border-[#e8e4dc]/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-[#e8e4dc]/40">
          <span>&copy; 2026 Bright Ears &mdash; the AI office for DJs &amp; performers</span>
          <div className="flex gap-5">
            {NAV.map((n) => (
              <a key={n} href="#" className="transition-colors hover:text-[#e8e4dc]/80">
                {n}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
