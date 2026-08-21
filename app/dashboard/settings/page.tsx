// The Control Room (Phase 2b) — one cockpit for everything the AI office needs
// to sound like you and hunt for you. Replaces the old split Profile + Settings
// pages: five anchored sections (Identity · Voice & profile · Where you hunt ·
// Connections · Plan & billing) tracked by a sticky rail (components/
// control-room-nav.tsx). Each section has ONE writer action so saving one can
// never clobber another's columns (see app/actions/{settings,profile,travel}.ts).
//
// Canonical URL stays /dashboard/settings (billing redirects, OAuth callbacks,
// at-cap banners and push notifications all deep-link here); /dashboard/profile
// now redirects to #profile. Design LAW (docs/DESIGN.md v2.1): ink canvas,
// white/cream cards, cyan = interface, mono kickers, NO emoji ever.
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { uploadsEnabled } from "@/lib/uploads/r2";
import { Card, Badge, buttonStyles, Kicker, PageHeader, StatPill } from "@/components/ui";
import { StickerChip } from "@/components/collage";
import { SettingsForm, CopyButton } from "@/components/settings-form";
import { VoiceCard } from "@/components/voice-card";
import { ProfileForm } from "@/components/profile-form";
import { TravelWindowsCard, type TravelWindowRow } from "@/components/travel-windows-card";
import { PushToggle } from "@/components/push-toggle";
import { MailboxCard, type MailboxState } from "@/components/mailbox-card";
import { AutoSendCard } from "@/components/auto-send-card";
import { AttachmentAutonomyCard } from "@/components/attachment-autonomy-card";
import { ControlRoomNav, type ControlRoomSection } from "@/components/control-room-nav";
import { RosterCard } from "@/components/roster-card";
import { isConfigured as isMailboxConfigured } from "@/lib/oauth/google";
import { startCheckout, openBillingPortal, openPlanChange, billingState } from "@/app/actions/billing";
import { PLAN_LEAD_CAPS, meterState, type MeterState } from "@/lib/billing/metering";
import { planFeatures } from "@/lib/billing/plan-features";
import { profileStrength } from "@/lib/profile/strength";
import { RISK_REVERSAL } from "@/lib/marketing/guarantee";
import type { ReactNode } from "react";
import { getTranslations } from "@/lib/i18n/server";
import type { Translator } from "@/lib/i18n/messages";
import type { Locale } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

type BillingState = Awaited<ReturnType<typeof billingState>>;

// Roster is Studio machinery — a solo artist on Starter/Pro never needs to
// think about "who performs under this act" (founder call 2026-07-10). The
// section (and its rail entry) appears only on Studio, or when performers
// already exist (a downgraded tenant must still see their roster).
const SECTIONS: ControlRoomSection[] = [
  { id: "identity", label: "Identity" },
  { id: "profile", label: "Voice & profile" },
  { id: "hunt", label: "Where you hunt" },
  { id: "roster", label: "Roster" },
  { id: "cadence", label: "Cadence" },
  { id: "connections", label: "Connections" },
  { id: "billing", label: "Plan & billing" },
];

// ADR-003 tier recut: every plan is the complete assistant — blurbs gate
// capacity/autonomy (inquiries, autonomy, cities), never capability. Every
// claim here is enforced via lib/billing/plan-features.ts; multi-performer/
// team claims return only when the roster ships (P13).
const PLAN_CARDS = [
  { plan: "STARTER" as const, price: "$25", blurb: `Hunts venues + answers inquiries · ${PLAN_LEAD_CAPS.STARTER} inquiries/mo · you approve every send` },
  { plan: "PRO" as const, price: "$79", blurb: `Same engine, working harder · ${PLAN_LEAD_CAPS.PRO} inquiries/mo · auto-send autopilot · hunts 3 cities` },
  { plan: "STUDIO" as const, price: "$149", blurb: `Same engine at full stretch · ${PLAN_LEAD_CAPS.STUDIO} inquiries/mo · auto-send · hunts all your cities · roster of performers` },
];

/** Ladder position for upgrade-vs-switch button labels. */
const PLAN_RANK = { STARTER: 0, PRO: 1, STUDIO: 2 } as const;

const TH_MISSING_HINTS: Record<string, string> = {
  "Add one clear performance photo — venues need to see the act": "เพิ่มรูปการแสดงที่ชัดเจน 1 รูป เพื่อให้สถานที่เห็นรูปแบบการแสดงของคุณ",
  "Add two more photos to round out your press kit": "เพิ่มรูปอีก 2 รูปเพื่อให้เพรสคิตสมบูรณ์",
  "Write a short bio in your own voice — 40 to 120 words is the sweet spot": "เขียนประวัติสั้น ๆ ด้วยน้ำเสียงของคุณ ประมาณ 40–120 คำ",
  "Give yourself a headline — the one line a venue reads first": "เพิ่มพาดหัวสั้น ๆ ซึ่งเป็นประโยคแรกที่สถานที่จะอ่าน",
  "Add a package for inbound replies — the agent quotes from your rate card": "เพิ่มแพ็กเกจเพื่อให้ผู้ช่วยเสนอราคาเมื่อลูกค้าติดต่อมา",
  "Tag your genres and vibe — it's how the agent matches you to venues": "เพิ่มแนวและบรรยากาศการแสดง เพื่อให้ผู้ช่วยจับคู่กับสถานที่ได้เหมาะสม",
  "Name the cities you serve — the agent only hunts where you play": "ระบุเมืองที่คุณรับงาน ผู้ช่วยจะค้นหาเฉพาะพื้นที่ที่คุณเลือก",
  "Add your business mailing address — venue emails must identify a real sender": "เพิ่มที่อยู่ธุรกิจ เพราะอีเมลถึงสถานที่ต้องระบุผู้ส่งจริง",
  "Set your fee floor — the agent never pitches below it": "กำหนดค่าจ้างขั้นต่ำ ผู้ช่วยจะไม่เสนอราคาต่ำกว่านี้",
  "Put a gig on your calendar — availability is half of every pitch": "เพิ่มงานในปฏิทิน เพื่อให้ผู้ช่วยตรวจวันว่างได้",
  "List the event types you play — weddings, corporate, club nights": "ระบุประเภทงานที่รับ เช่น งานแต่ง งานบริษัท หรือคลับ",
  "Paste a client quote or two — borrowed trust closes venues": "เพิ่มรีวิวจากลูกค้า 1–2 ข้อเพื่อสร้างความน่าเชื่อถือ",
  "Name venues you've played — bookers recognize rooms, not bios": "ระบุสถานที่ที่เคยแสดง เพื่อให้ผู้จองเห็นประสบการณ์ของคุณ",
  "Set your sweet-spot fee — what the agent aims for, not just your floor": "กำหนดค่าจ้างเป้าหมายที่ผู้ช่วยควรเสนอ",
  "Spell out your travel policy — saves a back-and-forth on every pitch": "ระบุนโยบายการเดินทาง เพื่อลดการถามตอบซ้ำ",
};

/** A Control Room section: ink-canvas heading + intro, then its card(s). */
function Section({
  id,
  title,
  intro,
  children,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 lg:scroll-mt-8">
      <div className="mb-5">
        <h2 className="flex items-center gap-2.5 text-xl font-extrabold tracking-tight text-cream-bright">
          <span aria-hidden className="size-1.5 flex-none bg-brand-cyan" />
          {title}
        </h2>
        {intro && <p className="mt-1.5 max-w-xl text-sm text-cream/50">{intro}</p>}
      </div>
      <div className="space-y-6">{children}</div>
    </section>
  );
}

/** Profile strength + pitch-readiness meter (moved here from the old profile page). */
function StrengthMeter({
  percent,
  missing,
  canPitch,
  epkUrl,
  t,
  locale,
}: {
  percent: number;
  missing: string[];
  canPitch: boolean;
  epkUrl: string;
  t: Translator;
  locale: Locale;
}) {
  return (
    <div className="rounded-3xl bg-ink-raised border border-cream/10 px-6 py-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-[11px] font-bold uppercase tracking-[0.25em] text-cream/70">
          {t("settings.control.strength", { percent })}
        </span>
        {canPitch ? (
          <StickerChip tone="magenta" rotate={-2}>
            {t("settings.control.pitchReady")}
          </StickerChip>
        ) : (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-cream/65">
            {t("settings.control.pitchNotReady")}
          </span>
        )}
      </div>
      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-ink-stage">
        <div
          className="h-full rounded-full bg-gradient-to-r from-neon-magenta to-neon-orange transition-[width] duration-500"
          style={{ width: `${Math.max(percent, 2)}%` }}
        />
      </div>
      {missing.length > 0 ? (
        <ul className="mt-4 space-y-1.5">
          {missing.slice(0, 5).map((hint) => {
            // serviceCities is edited in the #hunt section, not in the profile
            // form below this meter — point the owner there so the to-do isn't a
            // dead end (the field moved out of the profile in Phase 2b).
            const isCities = hint.toLowerCase().includes("cities you serve");
            const localizedHint = locale === "th" ? TH_MISSING_HINTS[hint] ?? hint : hint;
            return (
              <li key={hint} className="flex items-start gap-2 text-sm text-cream/55">
                <span aria-hidden className="mt-2 size-1 flex-none bg-neon-magenta" />
                <span>
                  {localizedHint}
                  {isCities && (
                    <>
                      {" "}
                      <a href="#hunt" className="font-semibold text-brand-cyan hover:opacity-80">
                        {locale === "th" ? "ตั้งค่าในพื้นที่ค้นหา →" : "Set them in Where you hunt →"}
                      </a>
                    </>
                  )}
                </span>
              </li>
            );
          })}
          {missing.length > 5 && (
            <li className="text-xs text-cream/35">{locale === "th" ? `…และอีก ${missing.length - 5} รายการหลังจากทำรายการเหล่านี้` : `…and ${missing.length - 5} more after you finish these.`}</li>
          )}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-cream/55">
          {t("settings.control.fullyLoaded")}
        </p>
      )}
      <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <a
          href={epkUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-cyan hover:opacity-80 transition-opacity"
        >
          {t("settings.control.viewKit")}
        </a>
        <a
          href={`${epkUrl}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-brand-cyan hover:opacity-80 transition-opacity"
        >
          {t("settings.control.downloadPdf")}
        </a>
      </p>
    </div>
  );
}

function BillingCard({ meter, state, locale }: { meter: MeterState; state: BillingState; locale: Locale }) {
  const pct = meter.cap > 0 ? Math.min(100, Math.round((meter.used / meter.cap) * 100)) : 100;
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  const agentActive = state.subscribed || state.betaActive;
  const betaEnd = state.betaEndsAt?.toLocaleDateString(locale === "th" ? "th-TH" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const planBlurb = (plan: (typeof PLAN_CARDS)[number]) => locale === "th"
    ? ({
        STARTER: `ค้นหาสถานที่และตอบคำถาม · ${PLAN_LEAD_CAPS.STARTER} ข้อความ/เดือน · คุณอนุมัติทุกครั้ง`,
        PRO: `ระบบเดียวกันในระดับที่สูงขึ้น · ${PLAN_LEAD_CAPS.PRO} ข้อความ/เดือน · ส่งอัตโนมัติ · ค้นหา 3 เมือง`,
        STUDIO: `ระบบเต็มกำลัง · ${PLAN_LEAD_CAPS.STUDIO} ข้อความ/เดือน · ส่งอัตโนมัติ · ค้นหาทุกเมือง · จัดการศิลปินหลายคน`,
      } as const)[plan.plan]
    : plan.blurb;
  return (
    <Card className="p-6">
      {/* In-app usage meter + at-cap notice (audit C3): the at-cap state used to
          surface only via an optional push; show it here so an owner with push
          off still sees that drafting paused and how to fix it. */}
      <div className="mb-5">
        <div className="flex items-center justify-between text-xs text-ink-stage/60">
          <span>{c("Inquiries this month", "ข้อความสอบถามเดือนนี้")}</span>
          <span className="font-mono font-semibold text-ink-stage/75">
            {meter.used} / {meter.cap}
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-ink-stage/10">
          <div
            className={`h-full rounded-full ${meter.overCap ? "bg-neon-orange" : "bg-brand-cyan"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        {meter.overCap && agentActive && (
          <p className="mt-3 rounded-xl bg-[#ffdfba] px-3 py-2 text-sm text-ink-stage/80">
            <span className="font-semibold text-[#7a4100]">{c("Inquiry cap reached", "ถึงขีดจำกัดข้อความสอบถามแล้ว")}</span>{" "}
            {c("— new inquiries still arrive, but drafting is paused until you upgrade. No surprise bill, ever.", "— ข้อความใหม่ยังเข้ามา แต่ระบบหยุดร่างจนกว่าจะอัปเกรด และจะไม่มีค่าใช้จ่ายเกินคาด")}
          </p>
        )}
      </div>
      {state.betaActive ? (
        <div className="rounded-2xl border-2 border-brand-cyan bg-brand-cyan-soft/50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge tone="cyan">{c("30-day beta", "เบต้า 30 วัน")}</Badge>
              <h3 className="mt-3 text-xl font-extrabold text-ink-stage">
                {c("Your Starter beta is active", "เบต้าแผน Starter ของคุณเปิดใช้งานแล้ว")}
              </h3>
            </div>
            <span className="font-mono text-xs font-bold uppercase tracking-[0.12em] text-ink-stage/60">
              {c(`Ends ${betaEnd}`, `สิ้นสุด ${betaEnd}`)}
            </span>
          </div>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-stage/70">
            {c(
              "You have the complete Starter experience for 30 days. No payment method was collected and nothing renews automatically. At the end date your agent pauses; your setup and results stay saved, and only you can choose a paid plan.",
              "คุณใช้ฟีเจอร์ของแผน Starter ได้ครบเป็นเวลา 30 วัน โดยไม่ต้องเพิ่มวิธีชำระเงินและไม่มีการต่ออายุอัตโนมัติ เมื่อครบกำหนด ผู้ช่วยจะหยุดชั่วคราว แต่การตั้งค่าและผลลัพธ์ทั้งหมดจะยังคงอยู่ และมีเพียงคุณเท่านั้นที่เลือกสมัครแผนแบบชำระเงินได้",
            )}
          </p>
        </div>
      ) : !state.enabled ? (
        <p className="text-sm text-ink-stage/60">{c("Billing isn't configured in this environment yet.", "ยังไม่ได้ตั้งค่าการเรียกเก็บเงินในระบบนี้")}</p>
      ) : state.subscribed ? (
        // The ladder stays visible after subscribing (audit 2026-07): upgrades
        // are the only revenue-expansion path, and "how hard the AI works" is
        // the axis — turning the machine up should always be one tap away.
        <div>
          <p className="text-sm text-ink-stage/60 mb-5">
            {c("Turn your assistant up or down anytime — plan switches prorate automatically and apply on one confirm. Payment method, invoices and cancelling live under Manage billing.", "ปรับแผนขึ้นหรือลงได้ทุกเมื่อ ระบบคำนวณส่วนต่างให้อัตโนมัติและใช้หลังยืนยันครั้งเดียว จัดการวิธีชำระเงิน ใบแจ้งหนี้ และการยกเลิกได้ที่จัดการการเรียกเก็บเงิน")}
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {PLAN_CARDS.map((p) => {
              const current = p.plan === state.plan;
              const upgrade =
                state.plan in PLAN_RANK &&
                PLAN_RANK[p.plan] > PLAN_RANK[state.plan as keyof typeof PLAN_RANK];
              return (
                <form
                  key={p.plan}
                  action={current ? openBillingPortal : openPlanChange.bind(null, p.plan)}
                  className={`relative flex flex-col gap-2 rounded-2xl bg-cream p-5 ${
                    current ? "ring-2 ring-brand-cyan" : ""
                  }`}
                >
                  {current && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <Badge tone="cyan">{c("Your plan", "แผนของคุณ")}</Badge>
                    </div>
                  )}
                  <div className="font-bold text-ink-stage">
                    {p.plan.charAt(0) + p.plan.slice(1).toLowerCase()}
                  </div>
                  <div className="text-3xl font-extrabold tracking-tight text-ink-stage">
                    {p.price}
                    <span className="text-sm font-normal text-ink-stage/50">/{c("mo", "เดือน")}</span>
                  </div>
                  <div className="text-xs text-ink-stage/60 flex-1">{planBlurb(p)}</div>
                  <button
                    className={
                      current
                        ? buttonStyles.secondaryOnLight
                        : upgrade
                          ? buttonStyles.primary
                          : buttonStyles.secondaryOnLight
                    }
                  >
                    {current ? c("Manage billing", "จัดการการเรียกเก็บเงิน") : upgrade ? c("Upgrade", "อัปเกรด") : c("Switch", "เปลี่ยนแผน")}
                  </button>
                </form>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-ink-stage/60 mb-5">
            {state.betaExpired
              ? c(
                  "Your 30-day beta has ended and your agent is paused. Your setup, leads and results are still saved. Choose a plan only if you want Bright Ears to continue working for you.",
                  "เบต้า 30 วันสิ้นสุดแล้วและผู้ช่วยหยุดชั่วคราว การตั้งค่า ลีด และผลลัพธ์ทั้งหมดของคุณยังคงอยู่ เลือกแผนเมื่อคุณต้องการให้ Bright Ears ทำงานต่อ",
                )
              : c(
                  "Your agent is paused — choose a plan to switch it on. Your setup is saved and new inquiries still arrive; the moment you subscribe it starts replying in your voice and hunting venues for you.",
                  "ผู้ช่วยหยุดชั่วคราว เลือกแผนเพื่อเปิดใช้งาน การตั้งค่าของคุณยังอยู่และข้อความใหม่ยังเข้ามา เมื่อสมัครแล้วผู้ช่วยจะเริ่มตอบด้วยน้ำเสียงของคุณและค้นหาสถานที่ให้ทันที",
                )}
          </p>
          <div className="grid sm:grid-cols-3 gap-4">
            {PLAN_CARDS.map((p) => {
              const popular = p.plan === "PRO";
              return (
                // Plan cards = cream poster panels; Pro wears the magenta show ring.
                <form
                  key={p.plan}
                  action={startCheckout.bind(null, p.plan)}
                  className={`relative flex flex-col gap-2 rounded-2xl bg-cream p-5 ${
                    popular
                      ? "ring-2 ring-neon-magenta shadow-[0_10px_30px_rgba(255,45,174,0.2)]"
                      : ""
                  }`}
                >
                  {popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
                      <Badge tone="teal">{c("Most popular", "นิยมที่สุด")}</Badge>
                    </div>
                  )}
                  <div className="font-bold text-ink-stage">{p.plan.charAt(0) + p.plan.slice(1).toLowerCase()}</div>
                  <div className="text-3xl font-extrabold tracking-tight text-ink-stage">
                    {p.price}
                    <span className="text-sm font-normal text-ink-stage/50">/{c("mo", "เดือน")}</span>
                  </div>
                  <div className="text-xs text-ink-stage/60 flex-1">{planBlurb(p)}</div>
                  <button className={popular ? buttonStyles.primary : buttonStyles.secondaryOnLight}>{c("Choose", "เลือก")}</button>
                </form>
              );
            })}
          </div>
          <p className="mt-4 text-xs text-ink-stage/60">
            {c(`Month-to-month. Renews automatically each month until you cancel. Cancel anytime in Plan & billing → Manage billing; no charge after you cancel. ${RISK_REVERSAL.capLine}`, "ชำระรายเดือนและต่ออายุอัตโนมัติจนกว่าจะยกเลิก ยกเลิกได้ทุกเมื่อที่ แผนและการเรียกเก็บเงิน → จัดการการเรียกเก็บเงิน หลังยกเลิกจะไม่มีค่าใช้จ่ายเพิ่มเติม และไม่มีค่าบริการเกินขีดจำกัดโดยไม่แจ้ง")}
          </p>
        </div>
      )}
    </Card>
  );
}

/** Short, mono plan label for the header status readout. */
function planLabel(state: BillingState, t: Translator): string {
  return state.betaActive
    ? "Starter beta"
    : state.subscribed
      ? state.plan
      : t("settings.control.notSubscribed");
}

export default async function ControlRoomPage({
  searchParams,
}: {
  searchParams: Promise<{
    mailbox?: string | string[];
    reason?: string | string[];
    billing?: string | string[];
  }>;
}) {
  const { locale, t } = await getTranslations();
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  const sp = await searchParams;
  const mailbox = Array.isArray(sp.mailbox) ? sp.mailbox[0] : sp.mailbox ?? null;
  const reason = Array.isArray(sp.reason) ? sp.reason[0] : sp.reason ?? null;
  const billing = Array.isArray(sp.billing) ? sp.billing[0] : sp.billing ?? null;

  const business = await getCurrentBusiness();
  const leadAddress = `leads@${business.slug}.in.brightears.io`;

  // One pass of the reads the cockpit needs: usage meter, billing state, the
  // profile-strength inputs, the live travel windows, and the mailbox state.
  const [meter, billingSt, activePackages, gigs, travelWindows, mailboxConn, sequenceTemplate, performers] = await Promise.all([
    meterState(business.id, business, new Date(), business.timezone),
    billingState(),
    db.package.count({ where: { businessId: business.id, active: true } }),
    db.gig.count({ where: { businessId: business.id } }),
    db.travelWindow.findMany({
      where: { businessId: business.id, status: "ACTIVE" },
      orderBy: { startDate: "asc" },
      select: {
        id: true,
        city: true,
        country: true,
        startDate: true,
        endDate: true,
        radiusKm: true,
        roleTags: true,
        status: true,
      },
    }),
    isMailboxConfigured()
      ? db.mailboxConnection.findUnique({
          where: { businessId: business.id },
          select: { email: true, status: true, lastError: true },
        })
      : Promise.resolve(null),
    // Cadence card (P6.15): the tenant's real follow-up day-offsets.
    db.sequenceTemplate.findFirst({
      where: { businessId: business.id, active: true },
      select: { stepsDays: true },
    }),
    // P13 roster: every performer, active first (history is kept, not deleted).
    db.performer.findMany({
      where: { businessId: business.id },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
  ]);

  const strength = profileStrength(business, { activePackages, gigs });

  const showRoster = business.plan === "STUDIO" || performers.length > 0;
  const sectionLabels: Record<string, string> = {
    identity: t("settings.control.identity"),
    profile: t("settings.control.profile"),
    hunt: t("settings.control.hunt"),
    roster: t("settings.control.roster"),
    cadence: t("settings.control.cadence"),
    connections: t("settings.control.connections"),
    billing: t("settings.control.billing"),
  };
  const visibleSections = SECTIONS
    .filter((s) => s.id !== "roster" || showRoster)
    .map((s) => ({ ...s, label: sectionLabels[s.id] ?? s.label }));

  // Travel windows are date-only (UTC midnight) — serialize to YYYY-MM-DD.
  const isoDate = (d: Date) => d.toISOString().slice(0, 10);
  const travelWindowRows: TravelWindowRow[] = travelWindows.map((w) => ({
    ...w,
    startDate: isoDate(w.startDate),
    endDate: isoDate(w.endDate),
  }));

  // Resolve the mailbox card state from the single connection read above.
  let mailboxState: MailboxState;
  if (!isMailboxConfigured()) {
    mailboxState = { kind: "unconfigured" };
  } else if (!mailboxConn || mailboxConn.status === "REVOKED") {
    mailboxState = { kind: "disconnected" };
  } else if (mailboxConn.status === "ERROR") {
    mailboxState = { kind: "error", email: mailboxConn.email, lastError: mailboxConn.lastError };
  } else {
    mailboxState = { kind: "connected", email: mailboxConn.email };
  }
  const mailboxLive = mailboxState.kind === "connected";
  // Only show the mailbox status pill when OAuth is actually provisioned —
  // otherwise "Mailbox off" reads as the owner's fault on an env that simply
  // doesn't have sending configured (the card itself says "not enabled here").
  const mailboxConfigured = mailboxState.kind !== "unconfigured";

  return (
    <main className="flex-1 bg-ink-stage">
      <div className="mx-auto w-full max-w-6xl px-6 py-8">
        <PageHeader
          title={t("settings.control.title")}
          accent={t("settings.control.accent")}
          subtitle={t("settings.control.subtitle")}
          stats={
            <>
              <StatPill tone={strength.canPitch ? "teal" : "white"}>
                {t("settings.control.profileStat", { percent: strength.percent })}
              </StatPill>
              <StatPill>{planLabel(billingSt, t)}</StatPill>
              {mailboxConfigured && (
                <StatPill tone={mailboxLive ? "teal" : "white"}>
                  {mailboxLive
                    ? t("settings.control.mailboxLive")
                    : t("settings.control.mailboxOff")}
                </StatPill>
              )}
            </>
          }
        />

        {/* Post-checkout confirmation (audit C3): billing.ts redirects here with
            ?billing=success|cancelled — surfaced at the top so it's seen on land.
            "Live" only when the webhook has actually flipped the plan; until
            then the honest state is "finalizing" (Stripe's webhook usually
            lands within seconds, but the URL param alone proves nothing). */}
        {billing === "success" &&
          (billingSt.subscribed ? (
            <div className="mb-6 rounded-2xl bg-brand-cyan-soft px-5 py-4 text-sm font-medium text-ink-stage">
              You&apos;re subscribed — your agent is live. Manage your plan anytime in Plan &amp; billing below.
            </div>
          ) : (
            <div className="mb-6 rounded-2xl bg-brand-cyan-soft px-5 py-4 text-sm font-medium text-ink-stage">
              Payment received — finalizing your subscription. Your agent switches on the moment
              it&apos;s confirmed (usually under a minute); refresh to see it live.
            </div>
          ))}
        {billing === "cancelled" && (
          <div className="mb-6 rounded-2xl border border-cream/15 bg-ink-raised px-5 py-4 text-sm text-cream/80">
            Checkout cancelled — no charge was made. You can pick a plan whenever you&apos;re ready.
          </div>
        )}

        <div className="lg:grid lg:grid-cols-[176px_1fr] lg:gap-12">
          <ControlRoomNav sections={visibleSections} />

          <div className="min-w-0 space-y-14">
            <Section
              id="identity"
              title={t("settings.control.identity")}
              intro={t("settings.control.identityIntro")}
            >
              <Card className="p-6">
                <SettingsForm
                  business={{
                    name: business.name,
                    ownerName: business.ownerName,
                    postalAddress: business.postalAddress,
                    replyToEmail: business.replyToEmail,
                    timezone: business.timezone,
                    country: business.country,
                    websiteUrl: business.websiteUrl,
                    bookingLinkUrl: business.bookingLinkUrl,
                    performerKind: business.performerKind,
                  }}
                />
              </Card>
            </Section>

            <Section
              id="profile"
              title={t("settings.control.profile")}
              intro={t("settings.control.profileIntro")}
            >
              <StrengthMeter
                percent={strength.percent}
                missing={strength.missing}
                canPitch={strength.canPitch}
                epkUrl={`/epk/${business.slug}`}
                t={t}
                locale={locale}
              />
              <VoiceCard
                voice={{
                  voiceSamples: business.voiceSamples,
                  voiceGreeting: business.voiceGreeting,
                  voiceSignoff: business.voiceSignoff,
                  voiceUsesEmoji: business.voiceUsesEmoji,
                  voicePhrases: business.voicePhrases,
                }}
              />
              <ProfileForm
                profile={{
                  headline: business.headline,
                  bio: business.bio,
                  genres: business.genres,
                  eventTypes: business.eventTypes,
                  pitchLanguages: business.pitchLanguages,
                  videoLinks: business.videoLinks,
                  photoUrls: business.photoUrls,
                  socialLinks: business.socialLinks,
                  riderNotes: business.riderNotes,
                  reviewQuotes: business.reviewQuotes,
                  notableVenues: business.notableVenues,
                  travelPolicy: business.travelPolicy,
                  feeFloor: business.feeFloor,
                  feeSweetSpot: business.feeSweetSpot,
                  gigTypes: business.gigTypes,
                  acceptsTravel: business.acceptsTravel,
                  residencyRate: business.residencyRate,
                  residencyRateUnit: business.residencyRateUnit,
                  oneOffHours: business.oneOffHours,
                  epkEnabled: business.epkEnabled,
                  currency: business.currency,
                }}
                uploadsEnabled={uploadsEnabled}
              />
            </Section>

            <Section
              id="hunt"
              title={t("settings.control.hunt")}
              intro={t("settings.control.huntIntro")}
            >
              <TravelWindowsCard
                serviceCities={business.serviceCities}
                homeRadiusKm={business.homeRadiusKm}
                homeCityCap={planFeatures(business.plan).homeCityCap}
                windows={travelWindowRows}
              />
            </Section>

            {showRoster && (
              <Section
                id="roster"
                title={t("settings.control.roster")}
                intro={t("settings.control.rosterIntro")}
              >
                <RosterCard
                  performers={performers}
                  rosterCap={planFeatures(business.plan).rosterCap}
                  locale={locale}
                />
              </Section>
            )}

            <Section
              id="cadence"
              title={t("settings.control.cadence")}
              intro={t("settings.control.cadenceIntro")}
            >
              <Card className="p-6">
                <h3 className="mb-1 font-bold text-ink-stage">{t("settings.control.followUp")}</h3>
                <p className="mb-4 text-sm text-ink-stage/60">
                  {t("settings.control.followUpHint")}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  {(sequenceTemplate?.stepsDays ?? [2, 5, 9]).map((day, i) => (
                    <span
                      key={`${day}-${i}`}
                      className="rounded-full border border-cream bg-cream/40 px-3.5 py-1.5 font-mono text-xs font-bold text-ink-stage/75"
                    >
                      {t("settings.control.day", { day })}
                    </span>
                  ))}
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/45">
                    {t("settings.control.closes")}
                  </span>
                </div>
                <p className="mt-4 text-xs text-ink-stage/50">
                  {t("settings.control.hardStops")}
                </p>
              </Card>
              <Card className="p-6">
                <h3 className="mb-1 font-bold text-ink-stage">{c("The dials, per plan", "สิ่งที่แต่ละแผนปรับได้")}</h3>
                <p className="mb-4 text-sm text-ink-stage/60">
                  {c("Every plan is the complete engine — these are the only things a plan changes. Yours is marked.", "ทุกแผนใช้ระบบหลักครบเหมือนกัน ต่างกันเฉพาะรายการด้านล่าง และแผนของคุณถูกทำเครื่องหมายไว้")}
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="text-left font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/50">
                        <th className="pb-2 pr-4 font-bold">{c("Dial", "รายการ")}</th>
                        {(["STARTER", "PRO", "STUDIO"] as const).map((p) => (
                          <th
                            key={p}
                            className={`pb-2 pr-4 font-bold ${
                              billingSt.plan === p ? "text-brand-cyan" : ""
                            }`}
                          >
                            {p.charAt(0) + p.slice(1).toLowerCase()}
                            {billingSt.plan === p ? c(" · yours", " · ของคุณ") : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="text-ink-stage/75">
                      {[
                        {
                          dial: c("Inquiries answered / month", "ข้อความสอบถามที่ตอบ / เดือน"),
                          values: ["15", "60", "150"] as const,
                        },
                        { dial: c("Cities hunted", "เมืองที่ค้นหา"), values: ["1", "3", c("All", "ทั้งหมด")] as const },
                        {
                          dial: c("Auto-send on trusted sources", "ส่งอัตโนมัติจากแหล่งที่ไว้ใจ"),
                          values: ["—", c("Yes", "ใช่"), c("Yes", "ใช่")] as const,
                        },
                      ].map((row) => (
                        <tr key={row.dial} className="border-t border-cream">
                          <td className="py-2.5 pr-4">{row.dial}</td>
                          {row.values.map((v, i) => {
                            const plan = (["STARTER", "PRO", "STUDIO"] as const)[i];
                            return (
                              <td
                                key={plan}
                                className={`py-2.5 pr-4 font-mono text-xs font-bold ${
                                  billingSt.plan === plan ? "text-brand-cyan" : ""
                                }`}
                              >
                                {v}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="mt-4 text-xs text-ink-stage/50">
                  {c("The daily scan and the venue-pitch allowance are the same on every plan — and research quality is never a dial.", "การค้นหารายวัน จำนวนข้อความแนะนำสถานที่ และคุณภาพงานวิจัยเท่ากันในทุกแผน")}
                </p>
              </Card>
            </Section>

            <Section
              id="connections"
              title={t("settings.control.connections")}
              intro={t("settings.control.connectionsIntro")}
            >
              <Card className="p-6">
                <h3 className="mb-4">
                  <Kicker onLight>{t("settings.control.address")}</Kicker>
                </h3>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="inline-flex max-w-full items-center rounded-full bg-brand-cyan-soft px-4 py-2">
                    <code className="select-all break-all font-mono text-sm font-semibold text-ink-stage">
                      {leadAddress}
                    </code>
                  </span>
                  <CopyButton text={leadAddress} />
                </div>
                <p className="text-sm leading-relaxed text-ink-stage/60">
                  {t("settings.control.addressBody")}
                </p>
              </Card>

              <AutoSendCard
                enabled={planFeatures(business.plan).autoSend}
                trusted={business.autoSendSources}
              />

              <AttachmentAutonomyCard
                autoAttachProfile={business.autoAttachProfile}
                autoAttachQuote={business.autoAttachQuote}
              />

              <MailboxCard state={mailboxState} mailbox={mailbox} reason={reason} />

              <Card className="p-6">
                <h3 className="mb-2">
                  <Kicker onLight>{t("settings.control.notifications")}</Kicker>
                </h3>
                <p className="text-sm text-ink-stage/60 mb-4">
                  {t("settings.control.notificationsHint")}
                </p>
                <PushToggle />
              </Card>
            </Section>

            <Section
              id="billing"
              title={t("settings.control.billing")}
              intro={
                <span className="inline-flex flex-wrap items-center gap-2">
                  {c(RISK_REVERSAL.short, "ไม่มีค่าบริการเกินขีดจำกัดโดยไม่แจ้ง และยกเลิกได้ทุกเมื่อ")}
                </span>
              }
            >
              <BillingCard meter={meter} state={billingSt} locale={locale} />
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}
