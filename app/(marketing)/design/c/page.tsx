import type { Metadata } from "next";

/**
 * DESIGN DIRECTION PREVIEW — "C: Voltage Light"
 * Warm cream canvas, electric magenta→orange display type, one ink band.
 * Fully self-contained: no imports from lib/ or components/. Static.
 */

export const metadata: Metadata = {
  title: "Bright Ears — Direction C: Voltage Light",
  robots: { index: false },
};

/* ---------- tiny helpers (server-side, static) ---------- */

// Interpolate a word color along the magenta (#ff2dae) → orange (#ff8a00) spectrum.
function spectrum(t: number): string {
  const r = 255;
  const g = Math.round(45 + (138 - 45) * t);
  const b = Math.round(174 + (0 - 174) * t);
  return `rgb(${r}, ${g}, ${b})`;
}

const QUOTE_WORDS = "“From hello to booked — I just tap Approve from the booth.”".split(" ");

const STATS = [
  { value: "<5 min", label: "designed to reply in under 5 minutes" },
  { value: "First", label: "couples often book whoever replies first" },
  { value: "$1,800", label: "an example booking you stop losing (illustrative)" },
];

const FEATURES = [
  {
    emoji: "🛡️",
    title: "The scam emails you never see",
    body: "Phishing, fake bookings, spam — flagged and filed before they ever reach your inbox.",
    bar: "#ff2dae",
    chipBg: "rgba(255, 45, 174, 0.12)",
  },
  {
    emoji: "✍️",
    title: "Replies in your voice, from your rate card",
    body: "Drafts that read like you wrote them — your real prices, your real availability.",
    bar: "#ff8a00",
    chipBg: "rgba(255, 138, 0, 0.14)",
  },
  {
    emoji: "📈",
    title: "Monday report: leads in, gigs booked",
    body: "One email each week — what came in, what closed, and what needs a nudge.",
    bar: "linear-gradient(90deg, #ff2dae, #ff8a00)",
    chipBg: "rgba(255, 92, 96, 0.12)",
  },
];

const NAV_LINKS = [
  { href: "/pricing", label: "Pricing" },
  { href: "/compare", label: "Compare" },
  { href: "/tools/inquiry-reply-generator", label: "Free tools" },
  { href: "/story", label: "Our story" },
];

/* ---------- background rings for the ink band ---------- */

function Rings() {
  const radii = [70, 140, 210, 280, 350, 420, 490, 560, 630];
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1200 720"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      {radii.map((r) => (
        <circle key={r} cx="840" cy="360" r={r} stroke="#ffffff" strokeOpacity="0.06" strokeWidth="1.5" />
      ))}
      {radii.slice(0, 5).map((r) => (
        <circle key={`l${r}`} cx="120" cy="640" r={r} stroke="#ffffff" strokeOpacity="0.045" strokeWidth="1.5" />
      ))}
    </svg>
  );
}

/* ---------- classical bust, pure SVG ---------- */

function Bust() {
  return (
    <svg viewBox="0 0 220 260" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full" aria-hidden="true">
      <defs>
        <linearGradient id="vlBustBody" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="1" stopColor="#d6d0c1" />
        </linearGradient>
        <linearGradient id="vlBustGlow" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff2dae" />
          <stop offset="1" stopColor="#ff8a00" />
        </linearGradient>
      </defs>
      {/* plinth */}
      <rect x="48" y="228" width="124" height="18" rx="5" fill="#cdc6b5" />
      <rect x="58" y="220" width="104" height="10" rx="4" fill="#dad4c5" />
      {/* profile silhouette */}
      <path
        d="M118 12
           C 95 12 80 30 76 50
           C 75 56 74 59 72 62
           C 69 67 64 72 62 77
           C 61 80 65 82 70 83
           C 69 86 66 90 67 93
           C 68 95 71 96 71 96
           C 68 99 66 104 68 108
           C 70 112 76 113 80 114
           C 84 122 89 131 92 139
           C 94 144 95 150 94 156
           L 93 166
           C 85 180 64 190 50 198
           C 44 202 42 210 42 218
           L 42 228
           L 178 228
           L 178 218
           C 178 206 170 196 158 188
           C 148 181 140 172 140 160
           L 140 144
           C 142 140 144 136 146 132
           C 160 122 168 108 168 88
           C 168 46 152 12 118 12
           Z"
        fill="url(#vlBustBody)"
      />
      {/* duotone wash */}
      <path
        d="M118 12
           C 95 12 80 30 76 50
           C 75 56 74 59 72 62
           C 69 67 64 72 62 77
           C 61 80 65 82 70 83
           C 69 86 66 90 67 93
           C 68 95 71 96 71 96
           C 68 99 66 104 68 108
           C 70 112 76 113 80 114
           C 84 122 89 131 92 139
           C 94 144 95 150 94 156
           L 93 166
           C 85 180 64 190 50 198
           C 44 202 42 210 42 218
           L 42 228
           L 178 228
           L 178 218
           C 178 206 170 196 158 188
           C 148 181 140 172 140 160
           L 140 144
           C 142 140 144 136 146 132
           C 160 122 168 108 168 88
           C 168 46 152 12 118 12
           Z"
        fill="url(#vlBustGlow)"
        opacity="0.15"
      />
    </svg>
  );
}

/* ---------- the page ---------- */

export default function VoltageLightPreview() {
  return (
    <div className="min-h-screen bg-[#f4f1ea] text-[#17161f]">
      <style>{`
        @keyframes vl-sheen-spin { to { transform: rotate(360deg); } }
        @keyframes vl-float {
          0%, 100% { transform: rotate(-6deg) translateY(0); }
          50% { transform: rotate(-6deg) translateY(-10px); }
        }
        .vl-sheen { animation: vl-sheen-spin 22s linear infinite; }
        .vl-speaker { animation: vl-float 7s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .vl-sheen, .vl-speaker { animation: none; }
        }
      `}</style>

      {/* ===== Nav ===== */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-8">
        <a href="/design/c" className="flex items-baseline gap-1 text-xl font-extrabold tracking-tight">
          Bright Ears
          <span className="inline-block h-2.5 w-2.5 translate-y-[-1px] rounded-full bg-gradient-to-r from-[#ff2dae] to-[#ff8a00]" />
        </a>
        <nav className="flex items-center gap-8">
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hidden text-sm font-medium text-[#17161f]/70 transition-colors hover:text-[#17161f] sm:inline">
              {l.label}
            </a>
          ))}
          <a
            href="/onboarding"
            className="rounded-full bg-[#ff2dae] px-5 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(255,45,174,0.55)] transition-transform hover:scale-[1.03]"
          >
            Start free
          </a>
        </nav>
      </header>

      {/* ===== Hero ===== */}
      <section className="mx-auto max-w-6xl px-6 pt-16 pb-24">
        <span className="inline-flex items-center gap-2.5 rounded-full border border-[#17161f]/25 bg-white/60 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#17161f]/75">
          <span className="h-2 w-2 rounded-full bg-gradient-to-r from-[#ff2dae] to-[#ff8a00]" />
          AI office for DJs &amp; performers
        </span>

        <h1 className="mt-7 max-w-5xl bg-gradient-to-br from-[#ff2dae] via-[#ff4f73] to-[#ff8a00] bg-clip-text text-7xl font-extrabold leading-[0.95] tracking-[-0.045em] text-transparent xl:text-8xl">
          Stop being the
          <br />
          5th DJ to reply
        </h1>

        <div className="mt-12 grid items-center gap-14 lg:grid-cols-[1fr_1.05fr]">
          {/* left: copy + CTAs */}
          <div>
            <p className="max-w-xl text-xl leading-relaxed text-[#17161f]/75">
              Every inquiry answered in your voice in under 5 minutes, followed up for days, until it&rsquo;s
              booked — you just tap Approve.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-4">
              <a
                href="/onboarding"
                className="inline-flex items-center rounded-full bg-[#ff2dae] px-8 py-4 text-base font-semibold text-white shadow-[0_14px_40px_-8px_rgba(255,45,174,0.6)] transition-transform hover:scale-[1.03]"
              >
                Start free
              </a>
              <a
                href="/tools/inquiry-reply-generator"
                className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-[#17161f]/60 px-8 py-4 text-base font-semibold text-[#17161f] transition-colors hover:border-[#17161f]"
              >
                Watch the reply write itself
                <span aria-hidden="true" className="text-[#ff8a00]">▸</span>
              </a>
            </div>
            <p className="mt-7 font-mono text-xs uppercase tracking-[0.18em] text-[#17161f]/55">
              14-day free trial · no card · 5-minute setup
            </p>
          </div>

          {/* right: CSS/SVG collage */}
          <div className="relative hidden h-[480px] select-none lg:block" aria-hidden="true">
            {/* faint ink rings */}
            <svg className="absolute -right-6 -top-8 h-[440px] w-[440px] opacity-[0.07]" viewBox="0 0 400 400" fill="none">
              {[44, 84, 124, 164, 196].map((r) => (
                <circle key={r} cx="200" cy="200" r={r} stroke="#17161f" strokeWidth="1.5" />
              ))}
            </svg>

            {/* gradient blob */}
            <div
              className="absolute right-2 top-4 h-64 w-64 rounded-full opacity-50 blur-3xl"
              style={{ background: "radial-gradient(circle at 35% 35%, #ff2dae 0%, #ff8a00 70%, transparent 100%)" }}
            />

            {/* white halo ring */}
            <div className="absolute left-0 top-24 h-[180px] w-[430px] -rotate-[14deg] rounded-[50%] border-[14px] border-white shadow-[0_26px_48px_-22px_rgba(23,22,31,0.4)]" />

            {/* classical bust */}
            <div className="absolute bottom-2 right-0 w-[225px] drop-shadow-[0_28px_30px_rgba(23,22,31,0.3)]">
              <Bust />
            </div>

            {/* orange vinyl record */}
            <div className="absolute left-8 top-12 z-10 h-60 w-60 rounded-full shadow-[0_34px_60px_-18px_rgba(23,22,31,0.5)]">
              <div
                className="h-full w-full rounded-full"
                style={{
                  background:
                    "repeating-radial-gradient(circle at 50% 50%, #ff8a00 0px, #ff8a00 4px, #df6f00 5px, #ff8a00 6px)",
                }}
              />
              {/* rotating light sheen */}
              <div
                className="vl-sheen absolute inset-0 rounded-full"
                style={{
                  background:
                    "conic-gradient(from 210deg, rgba(255,255,255,0.35) 0deg, transparent 45deg, transparent 180deg, rgba(255,255,255,0.18) 205deg, transparent 245deg)",
                }}
              />
              {/* center label */}
              <div className="absolute inset-0 m-auto flex h-[88px] w-[88px] flex-col items-center justify-center gap-1 rounded-full bg-[#ff2dae] ring-4 ring-[#17161f]/10">
                <span className="font-mono text-[9px] font-bold uppercase tracking-[0.25em] text-white">Side A</span>
                <span className="h-2.5 w-2.5 rounded-full bg-[#f4f1ea]" />
              </div>
            </div>

            {/* studio speaker */}
            <div className="vl-speaker absolute bottom-0 left-28 z-20 flex h-56 w-40 -rotate-6 flex-col items-center justify-between rounded-[26px] border border-white/10 bg-[#1d1c26] p-5 shadow-[0_38px_60px_-16px_rgba(23,22,31,0.55)]">
              <div className="h-10 w-10 rounded-full border-[5px] border-[#3c3a49] bg-[#26242f]" />
              <div
                className="relative h-[104px] w-[104px] rounded-full border-[7px] border-[#3c3a49]"
                style={{ background: "radial-gradient(circle, #57546a 0%, #26242f 68%)" }}
              >
                <div className="absolute inset-0 m-auto h-9 w-9 rounded-full bg-[#17161f]" />
              </div>
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff2dae] shadow-[0_0_8px_2px_rgba(255,45,174,0.7)]" />
            </div>

            {/* sticker chips */}
            <div className="absolute left-1 top-1 z-30 flex -rotate-3 items-center gap-2 rounded-full border border-[#17161f]/20 bg-white px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] shadow-[0_10px_24px_-10px_rgba(23,22,31,0.4)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff2dae]" />
              Reply drafted · 0:47
            </div>
            <div className="absolute bottom-28 right-40 z-30 flex rotate-2 items-center gap-2 rounded-full border border-[#17161f]/20 bg-white px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.14em] shadow-[0_10px_24px_-10px_rgba(23,22,31,0.4)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff8a00]" />
              Approved ✓
            </div>
          </div>
        </div>
      </section>

      {/* ===== Ink band: stats + pull quote ===== */}
      <section className="relative overflow-hidden bg-[#17161f] text-white">
        <Rings />
        <div
          className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full opacity-20 blur-3xl"
          style={{ background: "radial-gradient(circle, #ff2dae 0%, transparent 70%)" }}
        />

        <div className="relative mx-auto max-w-6xl px-6 py-24">
          <span className="inline-flex items-center gap-2.5 rounded-full border border-white/25 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-white/65">
            <span className="h-2 w-2 rounded-full bg-gradient-to-r from-[#ff2dae] to-[#ff8a00]" />
            Why minutes matter
          </span>

          {/* stats strip */}
          <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-0 md:divide-x md:divide-white/10">
            {STATS.map((s, i) => (
              <div key={s.value} className={i === 0 ? "md:pr-10" : "md:px-10"}>
                <div className="bg-gradient-to-r from-[#ff2dae] to-[#ff8a00] bg-clip-text text-5xl font-extrabold tracking-tight text-transparent xl:text-6xl">
                  {s.value}
                </div>
                <p className="mt-3 max-w-[26ch] text-sm leading-relaxed text-white/60">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="my-20 h-px bg-white/10" />

          {/* gradient-painted pull quote */}
          <figure className="max-w-4xl">
            <blockquote className="text-3xl font-bold leading-[1.15] tracking-tight md:text-[2.75rem]">
              {QUOTE_WORDS.map((word, i) => (
                <span key={`${word}-${i}`} style={{ color: spectrum(i / (QUOTE_WORDS.length - 1)) }}>
                  {word}
                  {i < QUOTE_WORDS.length - 1 ? " " : ""}
                </span>
              ))}
            </blockquote>
            <figcaption className="mt-7 font-mono text-xs uppercase tracking-[0.2em] text-white/50">
              — what the workflow feels like
            </figcaption>
          </figure>
        </div>
      </section>

      {/* ===== Feature cards ===== */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <span className="inline-flex items-center gap-2.5 rounded-full border border-[#17161f]/25 bg-white/60 px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] text-[#17161f]/75">
          <span className="h-2 w-2 rounded-full bg-gradient-to-r from-[#ff2dae] to-[#ff8a00]" />
          What it handles
        </span>

        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.title}
              className="rounded-2xl border border-[#17161f]/15 bg-white p-7 shadow-[0_18px_40px_-22px_rgba(23,22,31,0.35)]"
            >
              <div className="h-1.5 w-12 rounded-full" style={{ background: f.bar }} />
              <div
                className="mt-6 flex h-12 w-12 items-center justify-center rounded-xl text-xl"
                style={{ background: f.chipBg }}
              >
                <span aria-hidden="true">{f.emoji}</span>
              </div>
              <h3 className="mt-5 text-lg font-bold leading-snug tracking-tight">{f.title}</h3>
              <p className="mt-2.5 text-sm leading-relaxed text-[#17161f]/65">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* ===== Footer strip ===== */}
      <footer className="border-t border-[#17161f]/10">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 font-mono text-[11px] uppercase tracking-[0.18em] text-[#17161f]/50">
          <span>© 2026 Bright Ears</span>
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-[#ff2dae] to-[#ff8a00]" />
            Direction C — Voltage Light
          </span>
          <span>Made for the booth</span>
        </div>
      </footer>
    </div>
  );
}
