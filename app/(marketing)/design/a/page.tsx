import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Design A — Electric Stage",
  robots: { index: false },
};

/* ---------------------------------------------------------------- */
/* Direction A: "Electric Stage" — faithful royalstreaming skin.     */
/* Full ink-navy canvas, magenta→orange electric gradient display    */
/* type, neon-outline pill CTAs, concentric-ring backdrop, pure-CSS  */
/* collage art (orange vinyl + studio speaker + white halo + blob).  */
/* Static preview — no data, no imports beyond next Metadata.        */
/* ---------------------------------------------------------------- */

const INK = "#17161f";
const MAGENTA = "#ff2dae";
const ORANGE = "#ff8a00";

/* Word-by-word magenta→orange spectrum for the pull quote. */
const QUOTE_WORDS: Array<[string, string]> = [
  ["“From", "#ff2dae"],
  ["hello", "#ff359e"],
  ["to", "#ff3e8e"],
  ["booked", "#ff467f"],
  ["—", "#ff4f6f"],
  ["I", "#ff575f"],
  ["just", "#ff604f"],
  ["tap", "#ff683f"],
  ["Approve", "#ff712f"],
  ["from", "#ff7920"],
  ["the", "#ff8210"],
  ["booth.”", "#ff8a00"],
];

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/compare", label: "Compare" },
  { href: "/tools/inquiry-reply-generator", label: "Free tools" },
  { href: "/story", label: "Our story" },
];

const STATS = [
  { big: "<5 min", small: "median first reply" },
  { big: "~50%", small: "of couples book the first responder" },
  { big: "$1,800", small: "the booking you stop losing" },
];

const FEATURES = [
  {
    emoji: "🛡️",
    title: "The scam emails you never see",
    copy: "Phishing and fake-gig bait get filtered before they ever reach your inbox.",
  },
  {
    emoji: "✍️",
    title: "Replies in your voice, from your rate card",
    copy: "Drafts that sound like you — quoting your real prices, packages and dates.",
  },
  {
    emoji: "📈",
    title: "Monday report: leads in, gigs booked",
    copy: "One weekly email: what came in, what confirmed, what needs a nudge.",
  },
];

function NeonPill({
  href,
  children,
  primary = false,
}: {
  href: string;
  children: React.ReactNode;
  primary?: boolean;
}) {
  if (primary) {
    return (
      <a
        href={href}
        className="inline-block rounded-full p-[1.5px] shadow-[0_0_28px_rgba(255,45,174,0.5),0_0_60px_rgba(255,138,0,0.18)] transition-transform hover:-translate-y-0.5"
        style={{ backgroundImage: `linear-gradient(90deg, ${MAGENTA}, ${ORANGE})` }}
      >
        <span className="block rounded-full bg-[#17161f] px-7 py-3 text-sm font-semibold tracking-wide text-white">
          {children}
        </span>
      </a>
    );
  }
  return (
    <a
      href={href}
      className="inline-block rounded-full border-[1.5px] border-white/25 px-7 py-3 text-sm font-semibold tracking-wide text-white/85 transition-colors hover:border-white/50 hover:text-white"
    >
      {children}
    </a>
  );
}

export default function DesignAPage() {
  return (
    <div className="relative min-h-screen font-sans text-white" style={{ backgroundColor: INK }}>
      <style>{`
        /* Clean preview: hide the shared marketing chrome around this page. */
        body > div.flex-1 > header, body > div.flex-1 > footer { display: none !important; }
        body { background: ${INK}; }

        @keyframes ea-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        @keyframes ea-float-rot {
          0%, 100% { transform: rotate(-6deg) translateY(0); }
          50% { transform: rotate(-6deg) translateY(-8px); }
        }
        .ea-grad-text {
          background-image: linear-gradient(92deg, ${MAGENTA} 0%, #ff5470 45%, ${ORANGE} 100%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
      `}</style>

      {/* ============================== NAV ============================== */}
      <nav className="relative z-20 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <a href="/" className="flex items-center gap-2.5">
          <span
            className="inline-block h-3.5 w-3.5 rounded-full"
            style={{ backgroundImage: `linear-gradient(135deg, ${MAGENTA}, ${ORANGE})` }}
          />
          <span className="text-lg font-bold tracking-tight text-white">Bright Ears</span>
        </a>
        <div className="flex items-center gap-7 text-sm">
          {NAV_LINKS.map((n) => (
            <a key={n.href} href={n.href} className="hidden text-white/60 transition-colors hover:text-white sm:inline">
              {n.label}
            </a>
          ))}
          <a
            href="/onboarding"
            className="rounded-full p-px"
            style={{ backgroundImage: `linear-gradient(90deg, ${MAGENTA}, ${ORANGE})` }}
          >
            <span className="block rounded-full bg-[#17161f] px-5 py-2 text-sm font-semibold text-white">
              Start free
            </span>
          </a>
        </div>
      </nav>

      {/* ============================== HERO ============================== */}
      <section className="relative overflow-hidden">
        {/* Concentric thin-line rings */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-radial-gradient(circle at 74% 36%, transparent 0, transparent 88px, rgba(255,255,255,0.07) 88px, rgba(255,255,255,0.07) 89.5px)",
            maskImage: "radial-gradient(ellipse 80% 90% at 65% 40%, black 30%, transparent 78%)",
            WebkitMaskImage: "radial-gradient(ellipse 80% 90% at 65% 40%, black 30%, transparent 78%)",
          }}
        />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-6 pb-24 pt-14 lg:grid-cols-[1.05fr_0.95fr]">
          {/* ---- Copy ---- */}
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70">
              <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: MAGENTA }} />
              AI office for DJs &amp; performers
            </span>

            <h1 className="ea-grad-text mt-7 text-7xl font-extrabold leading-[0.98] tracking-tight xl:text-8xl">
              Stop being the 5th DJ to reply
            </h1>

            <p className="mt-7 max-w-xl text-lg leading-relaxed text-white/65">
              Every inquiry answered in your voice in under 5 minutes, followed up for days,
              until it&apos;s booked — you just tap Approve.
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <NeonPill href="/onboarding" primary>
                Start free
              </NeonPill>
              <NeonPill href="/tools/inquiry-reply-generator">Watch the reply write itself</NeonPill>
            </div>

            <p className="mt-6 text-sm text-white/40">
              14-day free trial · no card · 5-minute setup
            </p>
          </div>

          {/* ---- Collage art: orange vinyl + speaker + halo + glow ---- */}
          <div aria-hidden className="relative hidden h-[540px] select-none lg:block">
            {/* Magenta halo glow behind the whole piece */}
            <div
              className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                backgroundImage:
                  "radial-gradient(circle, rgba(255,45,174,0.38) 0%, rgba(255,45,174,0.12) 45%, transparent 70%)",
              }}
            />
            {/* Gradient blob, lower right */}
            <div
              className="absolute bottom-2 right-0 h-56 w-56 rounded-full opacity-60 blur-3xl"
              style={{ backgroundImage: `linear-gradient(135deg, ${MAGENTA}, ${ORANGE})` }}
            />

            {/* White halo ring threading behind the disc */}
            <div
              className="absolute left-[8%] top-[16%] h-[150px] w-[460px] rounded-[50%] border-[3px] border-white/90"
              style={{ transform: "rotate(-20deg)" }}
            />

            {/* Orange vinyl record */}
            <div
              className="absolute left-[22%] top-[8%] h-[330px] w-[330px] rounded-full shadow-[0_30px_80px_rgba(0,0,0,0.55)]"
              style={{
                backgroundImage:
                  "repeating-radial-gradient(circle at 50% 50%, #f58a07 0px, #f58a07 2px, #d97604 2px, #d97604 4.5px)",
                animation: "ea-float 7s ease-in-out infinite",
              }}
            >
              {/* sheen */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  backgroundImage:
                    "radial-gradient(circle at 30% 26%, rgba(255,255,255,0.32) 0%, transparent 42%), radial-gradient(circle at 75% 80%, rgba(23,22,31,0.28) 0%, transparent 50%)",
                }}
              />
              {/* magenta center label */}
              <div
                className="absolute left-1/2 top-1/2 flex h-[108px] w-[108px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full ring-2 ring-white/70"
                style={{ backgroundImage: `linear-gradient(140deg, ${MAGENTA}, #d4188c)` }}
              >
                <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-white/90">
                  Side A
                </span>
              </div>
              {/* spindle hole */}
              <div className="absolute left-1/2 top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#17161f]" />
            </div>

            {/* Studio speaker, lower left, tilted */}
            <div
              className="absolute bottom-[4%] left-[2%] h-[264px] w-[196px] rounded-[26px] border border-white/10 bg-[#201f2b] p-5 shadow-[0_30px_70px_rgba(0,0,0,0.6)]"
              style={{ animation: "ea-float-rot 8s ease-in-out infinite" }}
            >
              {/* tweeter */}
              <div className="mx-auto h-[54px] w-[54px] rounded-full border-2 border-white/15 bg-[#14131c]">
                <div
                  className="mx-auto mt-[13px] h-6 w-6 rounded-full"
                  style={{
                    backgroundImage: "radial-gradient(circle at 35% 32%, #4a4858, #16151e 70%)",
                  }}
                />
              </div>
              {/* woofer: ring + cone */}
              <div className="mx-auto mt-5 flex h-[136px] w-[136px] items-center justify-center rounded-full border-2 border-white/15 bg-[#14131c]">
                <div
                  className="flex h-[108px] w-[108px] items-center justify-center rounded-full"
                  style={{
                    backgroundImage: "radial-gradient(circle at 36% 32%, #3b3949, #0f0e16 75%)",
                  }}
                >
                  <div
                    className="h-9 w-9 rounded-full"
                    style={{
                      backgroundImage: `radial-gradient(circle at 35% 30%, #ffb45e, ${ORANGE} 70%)`,
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Floating product chips */}
            <div
              className="absolute right-[2%] top-[6%] flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-xs font-semibold text-white/85 shadow-lg backdrop-blur"
              style={{ animation: "ea-float 6s ease-in-out infinite" }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
              Replied in 4 min 51 s
            </div>
            <div
              className="absolute bottom-[16%] right-[10%] rounded-full p-[1.5px] shadow-[0_0_24px_rgba(255,45,174,0.45)]"
              style={{
                backgroundImage: `linear-gradient(90deg, ${MAGENTA}, ${ORANGE})`,
                animation: "ea-float 9s ease-in-out infinite",
              }}
            >
              <span className="block rounded-full bg-[#17161f] px-5 py-2 text-xs font-bold tracking-wide text-white">
                Approve ✓
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* ============================ STAT STRIP ============================ */}
      <section className="relative z-10 border-y border-white/10">
        <div className="mx-auto grid max-w-6xl grid-cols-1 divide-y divide-white/10 px-6 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          {STATS.map((s) => (
            <div key={s.small} className="py-10 text-center sm:px-6">
              <div className="ea-grad-text text-4xl font-extrabold tracking-tight">{s.big}</div>
              <div className="mt-2 text-sm text-white/50">{s.small}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== FEATURES — cream contrast band ===================== */}
      <section className="bg-[#e8e4dc] py-20" style={{ color: INK }}>
        <div className="mx-auto max-w-6xl px-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-[#17161f]/15 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#17161f]/60">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: ORANGE }} />
            While you were on stage
          </span>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-3xl border border-[#17161f]/8 bg-[#f4f1ea] p-8 shadow-[0_18px_44px_rgba(23,22,31,0.08)]"
              >
                <div
                  className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl"
                  style={{
                    backgroundImage: `linear-gradient(135deg, ${MAGENTA}1f, ${ORANGE}29)`,
                  }}
                >
                  {f.emoji}
                </div>
                <h3 className="mt-5 text-xl font-bold tracking-tight">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#17161f]/65">{f.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===================== PULL QUOTE — word spectrum ===================== */}
      <section className="relative overflow-hidden py-28">
        <div
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 h-[420px] w-[760px] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-25 blur-3xl"
          style={{ backgroundImage: `linear-gradient(90deg, ${MAGENTA}, ${ORANGE})` }}
        />
        <figure className="relative z-10 mx-auto max-w-4xl px-6 text-center">
          <blockquote className="text-4xl font-extrabold leading-[1.15] tracking-tight md:text-5xl">
            {QUOTE_WORDS.map(([word, color], i) => (
              <span key={i} style={{ color }}>
                {word}
                {i < QUOTE_WORDS.length - 1 ? " " : ""}
              </span>
            ))}
          </blockquote>
          <figcaption className="mt-7 text-sm font-medium uppercase tracking-[0.2em] text-white/40">
            — a beta DJ
          </figcaption>
        </figure>
      </section>

      {/* ============================== FOOTER ============================== */}
      <footer className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-6 text-xs text-white/35">
          <div className="flex items-center gap-2">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundImage: `linear-gradient(135deg, ${MAGENTA}, ${ORANGE})` }}
            />
            <span>© 2026 Bright Ears — your gigs, answered and booked.</span>
          </div>
          <div className="flex gap-5">
            {NAV_LINKS.map((n) => (
              <a key={n.href} href={n.href} className="transition-colors hover:text-white/70">
                {n.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
