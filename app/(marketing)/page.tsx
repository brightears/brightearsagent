// Bright Ears homepage — artist-first, outcome-first.
//
// The product has two jobs: find new rooms and handle the inquiries an artist
// already gets. The previous page repeated those mechanics across eleven long
// sections. This version tells the whole story in one pass: one profile, a
// working assistant, one approval queue. Motion demonstrates the work happening
// instead of adding decoration for decoration's sake.
import type { Metadata } from "next";
import Link from "next/link";
import {
  GradientBlob,
  HaloRing,
  RingsBackdrop,
  StickerChip,
  VinylDisc,
} from "@/components/collage";
import { DemoWidget } from "@/components/demo-widget";
import { BookingSignalStage } from "@/components/booking-signal-stage";
import { KineticHeadline, Marquee, RevealOnScroll } from "@/components/motion";
import { Kicker } from "@/components/ui";
import { pageMeta, organizationJsonLd, softwareApplicationJsonLd } from "@/lib/marketing/site";
import { getTranslations } from "@/lib/i18n/server";

export const metadata: Metadata = pageMeta(
  "Bright Ears — your booking assistant for more gigs and less chasing",
  "Build one artist profile. Bright Ears finds venues that fit, drafts pitches and replies in your voice, follows up, and waits for your approval. No video required.",
);

const MARQUEE_ITEMS = [
  "MORE PLAYING",
  "LESS CHASING",
  "PITCHES IN YOUR VOICE",
  "REPLIES READY",
  "YOU STAY IN CONTROL",
];

const EN_SETUP_STEPS = [
  {
    number: "01",
    title: "Build one artist profile",
    body: "Your sound, home city, fee floor, a short bio and one clear photo. Start with the essentials; polish the rest whenever you want.",
    note: "No video required",
  },
  {
    number: "02",
    title: "Your assistant goes looking",
    body: "It watches public venue signals and the sources you already use, then brings back the rooms and inquiries that actually fit.",
    note: "Starts when you subscribe",
  },
  {
    number: "03",
    title: "Approve from your phone",
    body: "Pitches and replies arrive already written in your voice. Tap approve, edit if you like, and Bright Ears handles the follow-up.",
    note: "You keep final say",
  },
];

const SMALL_WINS = [
  {
    label: "Travel mode",
    title: "Take the hunt with you",
    body: "Add a city and dates. Bright Ears looks for guest spots while you’re there.",
  },
  {
    label: "Quietly useful",
    title: "Scams stay out",
    body: "Suspicious inquiries are filtered before they become another thing on your phone.",
  },
  {
    label: "Still working",
    title: "Follow-up is automatic",
    body: "Polite nudges continue until there is an answer, a booking or an opt-out.",
  },
];

const PLANS = [
  {
    name: "Starter",
    price: "$25",
    body: "One home city · up to 15 inquiries a month · you approve every send",
    featured: true,
  },
  {
    name: "Pro",
    price: "$79",
    body: "Up to 3 cities · 60 inquiries a month · trusted-source autopilot",
    featured: false,
  },
  {
    name: "Studio",
    price: "$149",
    body: "All your cities · 150 inquiries a month · full-stretch autopilot",
    featured: false,
  },
];

export default async function HomePage() {
  const { locale, t } = await getTranslations();
  const SETUP_STEPS = locale === "th" ? [
    { number: "01", title: t("marketing.home.step1Title"), body: t("marketing.home.step1Body"), note: t("marketing.home.step1Note") },
    { number: "02", title: t("marketing.home.step2Title"), body: t("marketing.home.step2Body"), note: t("marketing.home.step2Note") },
    { number: "03", title: t("marketing.home.step3Title"), body: t("marketing.home.step3Body"), note: t("marketing.home.step3Note") },
  ] : EN_SETUP_STEPS;
  const marqueeItems = locale === "th"
    ? ["ได้งานมากขึ้น", "ไล่ตามน้อยลง", "ข้อความด้วยสำนวนของคุณ", "คำตอบพร้อมตรวจ", "คุณควบคุมเสมอ"]
    : MARQUEE_ITEMS;
  const smallWins = locale === "th"
    ? [
        { label: "โหมดเดินทาง", title: "พาการค้นหาไปกับคุณ", body: "เพิ่มเมืองและวันที่ แล้ว Bright Ears จะค้นหางานรับเชิญระหว่างที่คุณอยู่ที่นั่น" },
        { label: "ช่วยแบบเงียบ ๆ", title: "กันมิจฉาชีพออกไป", body: "ข้อความน่าสงสัยจะถูกกรองก่อนกลายเป็นอีกเรื่องในโทรศัพท์ของคุณ" },
        { label: "ยังทำงานต่อ", title: "ติดตามอัตโนมัติ", body: "ระบบติดตามอย่างสุภาพจนได้รับคำตอบ จองสำเร็จ หรือยกเลิกการรับข้อความ" },
      ]
    : SMALL_WINS;
  const matchSteps = locale === "th"
    ? ["อธิบายเหตุผลที่เหมาะ", "ค้นหาช่องทางติดต่อ", "ร่างข้อความแนะนำตัว", "คุณเป็นคนอนุมัติ"]
    : ["Fit explained", "Contact researched", "Pitch drafted", "You approve"];
  const plans = locale === "th"
    ? [
        { ...PLANS[0], body: "หนึ่งเมืองหลัก · สูงสุด 15 ข้อความต่อเดือน · คุณอนุมัติทุกครั้ง" },
        { ...PLANS[1], body: "สูงสุด 3 เมือง · 60 ข้อความต่อเดือน · ส่งอัตโนมัติจากแหล่งที่เชื่อถือ" },
        { ...PLANS[2], body: "ทุกเมืองของคุณ · 150 ข้อความต่อเดือน · ระบบอัตโนมัติเต็มรูปแบบ" },
      ]
    : PLANS;
  return (
    <div className="overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd()) }}
      />

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <RingsBackdrop />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(700px circle at 82% 180px, rgba(255,45,174,0.13), transparent 68%), radial-gradient(540px circle at 8% 80px, rgba(0,187,228,0.09), transparent 70%)",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-16 px-6 pb-20 pt-16 lg:grid-cols-[minmax(0,1.02fr)_minmax(0,0.98fr)] lg:pb-24 lg:pt-24">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-cream/25 bg-cream/5 px-4 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cream/75">
              <span className="size-1.5 rounded-full bg-brand-cyan" />
              {t("marketing.home.badge")}
            </span>
            <h1 className="mt-7 text-6xl font-black leading-[0.93] tracking-tighter text-cream-bright sm:text-7xl lg:text-[5.7rem]">
              <KineticHeadline accentWord={t("marketing.home.accent")}>{t("marketing.home.headline")}</KineticHeadline>
            </h1>
            <p className="mt-7 max-w-xl text-lg leading-relaxed text-cream/72 sm:text-xl">
              {t("marketing.home.hero")}{" "}
              <strong className="font-bold text-cream-bright">{t("marketing.home.heroStrong")}</strong>
            </p>

            <div className="mt-9 flex flex-wrap items-center gap-4">
              <Link
                href="/onboarding"
                prefetch={false}
                className="rounded-full bg-neon-magenta px-8 py-3.5 text-lg font-bold text-ink-stage shadow-[0_10px_36px_rgba(255,45,174,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_44px_rgba(255,45,174,0.55)] active:translate-y-0"
              >
                {t("marketing.home.build")}
              </Link>
              <a
                href="#how-it-works"
                className="rounded-full border-[1.5px] border-cream/35 px-7 py-3.5 text-lg font-semibold text-cream transition-colors hover:border-brand-cyan hover:text-brand-cyan"
              >
                {t("marketing.home.see")}
              </a>
            </div>

            <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-cream/55">
              <span>{t("marketing.home.noVideo")}</span>
              <span aria-hidden className="text-neon-magenta">/</span>
              <span>{t("marketing.home.saves")}</span>
              <span aria-hidden className="text-neon-magenta">/</span>
              <span>{t("marketing.home.monthly")}</span>
            </div>
          </div>

          <div className="min-w-0">
            <BookingSignalStage />
          </div>
        </div>
      </section>

      <Marquee items={marqueeItems} className="border-y border-cream/10 py-4" />

      {/* Setup story */}
      <section id="how-it-works" className="scroll-mt-24">
        <div className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <RevealOnScroll className="max-w-3xl">
            <Kicker>{t("marketing.home.setupKicker")}</Kicker>
            <h2 className="mt-4 text-4xl font-black tracking-tight text-cream-bright sm:text-6xl">
              {t("marketing.home.setupTitle")}
            </h2>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-cream/68">
              {t("marketing.home.setupBody")}
            </p>
          </RevealOnScroll>

          <div className="relative mt-14">
            <div
              aria-hidden
              className="absolute left-[16%] right-[16%] top-10 hidden h-px bg-gradient-to-r from-brand-cyan via-neon-magenta to-neon-orange lg:block"
            />
            <ol className="relative grid gap-6 lg:grid-cols-3">
              {SETUP_STEPS.map((step, index) => (
                <li key={step.number} className="h-full">
                  <RevealOnScroll className="h-full" delayMs={index * 110}>
                    <div className="relative h-full rounded-3xl border border-cream/10 bg-ink-raised p-6 transition-all duration-300 hover:-translate-y-1 hover:border-cream/20 hover:shadow-[0_18px_50px_rgba(0,0,0,0.3)]">
                      <span className="relative z-10 inline-flex size-12 items-center justify-center rounded-full bg-cream font-mono text-sm font-black text-ink-stage shadow-lg">
                        {step.number}
                      </span>
                      <h3 className="mt-6 text-2xl font-black tracking-tight text-cream-bright">
                        {step.title}
                      </h3>
                      <p className="mt-3 text-sm leading-relaxed text-cream/60">{step.body}</p>
                      <p className="mt-5 font-mono text-[10px] font-bold uppercase tracking-[0.16em] text-brand-cyan">
                        {step.note}
                      </p>
                    </div>
                  </RevealOnScroll>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* The two halves, explained in the simplest possible language. */}
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-4 sm:pb-20">
        <RevealOnScroll className="max-w-2xl lg:ml-auto lg:text-right">
          <Kicker>{t("marketing.home.twoKicker")}</Kicker>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-cream-bright sm:text-6xl">
            {t("marketing.home.twoTitle")}
          </h2>
        </RevealOnScroll>

        <div className="mt-12 grid gap-8 lg:grid-cols-[1.08fr_0.92fr]">
          <RevealOnScroll>
            <div className="relative h-full overflow-hidden rounded-[2rem] bg-cream p-8 text-ink-stage shadow-[0_28px_80px_rgba(0,0,0,0.42)] sm:p-10">
              <HaloRing width={250} height={92} tilt={-10} className="-right-8 top-12" />
              <StickerChip tone="magenta" rotate={-4}>{t("marketing.home.findSticker")}</StickerChip>
              <h3 className="relative mt-6 max-w-md text-4xl font-black leading-[0.98] tracking-tight sm:text-5xl">
                {t("marketing.home.findTitle")}
              </h3>
              <p className="relative mt-5 max-w-lg text-base leading-relaxed text-ink-stage/65">
                {t("marketing.home.findBody")}
              </p>
              <div className="relative mt-8 grid gap-2 sm:grid-cols-2">
                {matchSteps.map(
                  (item) => (
                    <div
                      key={item}
                      className="rounded-2xl border border-ink-stage/10 bg-white/70 px-4 py-3 text-sm font-bold"
                    >
                      <span className="mr-2 text-brand-cyan">/</span>
                      {item}
                    </div>
                  ),
                )}
              </div>
              <VinylDisc size={150} tone="orange" spin className="-bottom-16 -right-12" />
            </div>
          </RevealOnScroll>

          <RevealOnScroll delayMs={120}>
            <div className="relative h-full overflow-hidden rounded-[2rem] border border-cream/10 bg-ink-raised p-8 sm:p-10">
              <GradientBlob tone="cyan" className="-right-16 -top-16 h-52 w-72" />
              <StickerChip tone="cream" rotate={4}>{t("marketing.home.handleSticker")}</StickerChip>
              <h3 className="relative mt-6 text-4xl font-black leading-[0.98] tracking-tight text-cream-bright">
                {t("marketing.home.handleTitle")}
              </h3>
              <p className="relative mt-5 text-base leading-relaxed text-cream/65">
                {t("marketing.home.handleBody")}
              </p>
              <div className="relative mt-8 rounded-2xl bg-white p-4 text-ink-stage shadow-xl">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.16em] text-ink-stage/40">
                  {t("marketing.home.replyReady")}
                </p>
                <p className="mt-2 text-sm font-extrabold">
                  {locale === "th"
                    ? "“สวัสดีคุณเมย์ วันที่ 17 ตุลาคมยังว่างอยู่ และยินดีมากที่จะได้แสดงที่ Grandview…”"
                    : "“Hi Maya — October 17 is open, and I’d love to play the Grandview…”"}
                </p>
                <div className="mt-4 flex items-center justify-between gap-4">
                  <span className="text-xs text-ink-stage/45">
                    {locale === "th" ? "สำนวนของคุณ · ตรวจวันว่างแล้ว" : "Your voice · availability checked"}
                  </span>
                  <span className="rounded-full bg-brand-cyan px-3 py-1.5 text-xs font-black">
                    {t("marketing.home.approve")}
                  </span>
                </div>
              </div>
            </div>
          </RevealOnScroll>
        </div>

        <RevealOnScroll delayMs={100}>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {smallWins.map((win) => (
              <div key={win.title} className="rounded-3xl border border-cream/10 bg-ink-raised p-5">
                <p className="font-mono text-[9px] font-bold uppercase tracking-[0.18em] text-brand-cyan">
                  {win.label}
                </p>
                <h3 className="mt-2 text-lg font-black tracking-tight text-cream-bright">{win.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-cream/55">{win.body}</p>
              </div>
            ))}
          </div>
        </RevealOnScroll>
      </section>

      {/* Demo */}
      <section id="demo" className="scroll-mt-20 border-y border-cream/10">
        <RevealOnScroll className="mx-auto max-w-3xl px-6 py-20 sm:py-28">
          <Kicker>{t("marketing.home.demoKicker")}</Kicker>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-cream-bright sm:text-6xl">
            {t("marketing.home.demoTitle")}
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-cream/68">
            {t("marketing.home.demoBody")}
          </p>
          <div className="relative mt-10">
            <GradientBlob tone="show" className="-bottom-10 -left-8 h-44 w-72" />
            <DemoWidget />
          </div>
        </RevealOnScroll>
      </section>

      {/* Credibility without another long story section. */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <RevealOnScroll>
          <div className="relative overflow-hidden rounded-[2rem] border border-cream/10 bg-ink-raised p-8 sm:p-12">
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(520px circle at 90% 0%, rgba(255,45,174,0.14), transparent 68%), radial-gradient(420px circle at 4% 100%, rgba(0,187,228,0.09), transparent 70%)",
              }}
            />
            <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-end">
              <div className="max-w-3xl">
                <Kicker>{t("marketing.home.storyKicker")}</Kicker>
                <blockquote className="mt-4 text-3xl font-black leading-tight tracking-tight text-cream-bright sm:text-5xl">
                  {t("marketing.home.storyTitle")}
                </blockquote>
                <p className="mt-5 max-w-2xl text-base leading-relaxed text-cream/65">
                  {t("marketing.home.storyBody")}
                </p>
              </div>
              <Link
                href="/story"
                className="relative font-semibold text-brand-cyan transition-opacity hover:opacity-80"
              >
                {t("marketing.home.readStory")}
              </Link>
            </div>
          </div>
        </RevealOnScroll>
      </section>

      {/* Pricing */}
      <section className="mx-auto max-w-6xl px-6 py-12 sm:py-20">
        <RevealOnScroll className="max-w-3xl">
          <Kicker>{t("marketing.home.priceKicker")}</Kicker>
          <h2 className="mt-4 text-4xl font-black tracking-tight text-cream-bright sm:text-6xl">
            {t("marketing.home.priceTitle")}
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-cream/68">
            {t("marketing.home.priceBody")}
          </p>
        </RevealOnScroll>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {plans.map((plan, index) => (
            <RevealOnScroll key={plan.name} delayMs={index * 100}>
              <div
                className={`relative h-full rounded-3xl p-6 ${
                  plan.featured
                    ? "bg-cream text-ink-stage shadow-[0_24px_70px_rgba(0,0,0,0.42)]"
                    : "border border-cream/10 bg-ink-raised text-cream-bright"
                }`}
              >
                {plan.featured && (
                  <StickerChip tone="magenta" rotate={-3} className="absolute -right-2 -top-3">
                    {locale === "th" ? "เริ่มที่นี่" : "Start here"}
                  </StickerChip>
                )}
                <p
                  className={`font-mono text-[10px] font-bold uppercase tracking-[0.18em] ${
                    plan.featured ? "text-ink-stage/45" : "text-cream/50"
                  }`}
                >
                  {plan.name}
                </p>
                <p className="mt-3 text-4xl font-black tracking-tight">
                  {plan.price}
                  <span className={`text-sm font-normal ${plan.featured ? "text-ink-stage/45" : "text-cream/45"}`}>
                    /mo
                  </span>
                </p>
                <p className={`mt-3 text-sm leading-relaxed ${plan.featured ? "text-ink-stage/60" : "text-cream/55"}`}>
                  {plan.body}
                </p>
              </div>
            </RevealOnScroll>
          ))}
        </div>
        <RevealOnScroll>
          <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/pricing" className="font-semibold text-brand-cyan hover:opacity-80">
              {t("marketing.home.comparePlans")}
            </Link>
            <span className="text-sm text-cream/50">{t("marketing.home.priceFine")}</span>
          </div>
        </RevealOnScroll>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-8 pt-8">
        <RevealOnScroll>
          <div className="relative overflow-hidden rounded-[2rem] border border-cream/10 bg-ink-raised px-8 py-14 text-center shadow-[0_30px_90px_rgba(255,45,174,0.18)] sm:px-12 sm:py-16">
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(520px circle at 18% 0%, rgba(255,45,174,0.22), transparent 70%), radial-gradient(520px circle at 85% 100%, rgba(255,138,0,0.16), transparent 70%)",
              }}
            />
            <div className="relative">
              <Kicker>{t("marketing.home.finalKicker")}</Kicker>
              <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-black tracking-tight text-cream-bright sm:text-6xl">
                {t("marketing.home.finalTitle")}
              </h2>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-cream/68">
                {t("marketing.home.finalBody")}
              </p>
              <Link
                href="/onboarding"
                prefetch={false}
                className="mt-8 inline-block rounded-full bg-neon-magenta px-8 py-3.5 text-lg font-bold text-ink-stage shadow-[0_10px_36px_rgba(255,45,174,0.45)] transition-all hover:-translate-y-0.5 hover:shadow-[0_14px_44px_rgba(255,45,174,0.55)] active:translate-y-0"
              >
                {t("marketing.home.build")}
              </Link>
              <p className="mt-4 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-cream/50">
                {t("marketing.home.from")}
              </p>
            </div>
          </div>
        </RevealOnScroll>
      </section>
    </div>
  );
}
