"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { EMPTY_BRIEF, briefEmailHref, formatMusicBrief, type MusicBrief } from "@/lib/agency/brief";
import { inquirySchema, type InquirySource } from "@/lib/agency/inquiry-contract";
import styles from "@/app/(marketing)/agency.module.css";
import formStyles from "./agency-brief.module.css";

type Props = { th: boolean; initialArtist?: string; initialOccasion?: string; source?: InquirySource };

export function AgencyBrief({ th, initialArtist = "", initialOccasion = "", source = "home" }: Props) {
  const c = (en: string, thai: string) => th ? thai : en;
  const [brief, setBrief] = useState<MusicBrief>({
    ...EMPTY_BRIEF, occasion: initialOccasion,
    details: initialArtist ? (th ? "ดีเจที่สนใจ: " : "Preferred DJ: ") + initialArtist : "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [receipt, setReceipt] = useState("");
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [website, setWebsite] = useState("");
  const submissionKey = useRef<string | null>(null);
  const result = useRef<HTMLTextAreaElement>(null);
  const receiptBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const chooseSound = (event: Event) => {
      const value = (event as CustomEvent<unknown>).detail;
      if (typeof value !== "string" || value.length > 100 || submitting || receipt) return;
      setBrief(previous => ({ ...previous, sound: value }));
      submissionKey.current = null;
    };
    window.addEventListener("be:brief-sound", chooseSound);
    return () => window.removeEventListener("be:brief-sound", chooseSound);
  }, [submitting, receipt]);

  function change(key: keyof MusicBrief, value: string) {
    setBrief(previous => ({ ...previous, [key]: value }));
    submissionKey.current = null;
    setStatus("");
    setFailed(false);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || receipt) return;
    setSubmitting(true); setFailed(false); setStatus("");
    submissionKey.current ??= crypto.randomUUID();
    const payload = { submissionKey: submissionKey.current, locale: th ? "th" : "en", source: initialArtist && source === "home" ? "artist" : source, website, brief };
    if (!inquirySchema.safeParse(payload).success) {
      setSubmitting(false); setFailed(true);
      setStatus(c("Please check your name, email, venue, occasion and music direction. If you added a date, use a valid calendar date.", "โปรดตรวจสอบชื่อ อีเมล สถานที่ รูปแบบงาน และแนวดนตรี หากระบุวันที่ โปรดเลือกวันที่ที่ถูกต้อง"));
      return;
    }
    try {
      const response = await fetch("/api/agency/inquiries", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json();
      if (!response.ok || body.ok !== true || typeof body.reference !== "string") {
        if (response.status === 409) submissionKey.current = null;
        throw new Error(response.status === 429 ? "limit" : response.status === 400 ? "invalid" : "unavailable");
      }
      setReceipt(body.reference);
      setStatus(c("Your enquiry has been saved.", "บันทึกคำสอบถามของคุณแล้ว"));
      requestAnimationFrame(() => receiptBox.current?.focus());
    } catch (error) {
      setFailed(true);
      setStatus(error instanceof Error && error.message === "invalid"
        ? c("Please check the form details before sending again.", "โปรดตรวจสอบข้อมูลในแบบฟอร์มก่อนส่งอีกครั้ง")
        : error instanceof Error && error.message === "limit"
        ? c("Please try again in a few minutes, or share your brief with us on LINE.", "โปรดลองอีกครั้งในอีกสักครู่ หรือส่งบรีฟให้เราทาง LINE")
        : c("We couldn’t confirm your enquiry. Your details are still here—retry, or copy your brief and contact us below.", "ยังยืนยันการรับคำสอบถามไม่ได้ ข้อมูลของคุณยังอยู่ ลองส่งอีกครั้ง หรือคัดลอกบรีฟเพื่อติดต่อเราด้านล่าง"));
    } finally { setSubmitting(false); }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(formatMusicBrief(brief, th));
      setStatus(c("Copied. Paste your brief into LINE or an email.", "คัดลอกแล้ว วางบรีฟใน LINE หรืออีเมลได้เลย"));
    } catch {
      result.current?.focus(); result.current?.select();
      setStatus(c("Select and copy the brief below.", "เลือกและคัดลอกบรีฟด้านล่าง"));
    }
  }

  const fields: { key: keyof MusicBrief; label: string; placeholder?: string; type?: string; required?: boolean; max: number }[] = [
    { key: "venue", label: c("Venue & city", "สถานที่และเมือง"), placeholder: c("e.g. Rooftop bar, Bangkok", "เช่น รูฟท็อปบาร์ กรุงเทพฯ"), required: true, max: 100 },
    { key: "date", label: c("Date / start date (optional)", "วันที่ / วันเริ่มต้น (ไม่บังคับ)"), type: "date", max: 10 },
    { key: "time", label: c("Time & duration (optional)", "เวลาและระยะเวลา (ไม่บังคับ)"), placeholder: c("e.g. Fridays, 7–11 pm", "เช่น ทุกวันศุกร์ 19:00–23:00"), max: 100 },
    { key: "guests", label: c("Guests (optional)", "จำนวนแขก (ไม่บังคับ)"), placeholder: c("Approximate number", "จำนวนโดยประมาณ"), max: 50 },
  ];
  return <div className={styles.briefGrid}>
    <div className={styles.briefIntro}>
      <p className={styles.eyebrow}><span />{c("Make a music brief", "สร้างบรีฟดนตรี")}</p>
      <h2>{c("Your night.", "ค่ำคืนของคุณ")}<br /><em>{c("Your sound.", "เสียงดนตรีที่ใช่")}</em></h2>
      <p>{c("A rooftop residency, a restaurant opening, a one-off celebration. Give us the essentials and we’ll take the conversation from there.", "ไม่ว่าจะเป็นดีเจประจำรูฟท็อป เปิดร้านอาหาร หรืองานฉลอง บอกข้อมูลสำคัญให้เรา แล้วค่อยคุยรายละเอียดกันต่อ")}</p>
      <p className={styles.small}>{c("Send your enquiry directly to Bright Ears. You’ll receive a reference here once it’s saved.", "ส่งคำสอบถามถึง Bright Ears ได้โดยตรง คุณจะได้รับหมายเลขอ้างอิงที่นี่เมื่อบันทึกสำเร็จ")}</p>
      <a className={styles.textLink} href="https://page.line.me/944grjuq">{c("Prefer a conversation? Find us on LINE", "อยากคุยเลย? ติดต่อเราทาง LINE")} ↗</a>
    </div>
    <form className={styles.briefForm} onSubmit={submit} aria-busy={submitting}>
      <fieldset disabled={submitting || !!receipt} className={formStyles.fields}>
        <legend className={formStyles.srOnly}>{c("Your music enquiry", "คำสอบถามเรื่องดนตรีของคุณ")}</legend>
        <div className={styles.formGrid}>
          <label>{c("What are you planning?", "คุณกำลังวางแผนอะไร?")}<select required value={brief.occasion} onChange={e => change("occasion", e.target.value)}>
            <option value="">{c("Choose an occasion", "เลือกรูปแบบงาน")}</option>
            {[c("A regular venue programme", "โปรแกรมดนตรีประจำสถานที่"), c("A private celebration", "งานฉลองส่วนตัว"), c("A brand or corporate event", "งานแบรนด์หรือองค์กร"), c("A restaurant or venue opening", "เปิดร้านอาหารหรือสถานที่"), c("Something else", "รูปแบบอื่น")].map(value => <option key={value}>{value}</option>)}
          </select></label>
          {fields.map(field => <label key={field.key}>{field.label}<input required={field.required} type={field.type || "text"} maxLength={field.max} value={brief[field.key]} placeholder={field.placeholder} onChange={e => change(field.key, e.target.value)} /></label>)}
          <label>{c("Sound & atmosphere", "ดนตรีและบรรยากาศ")}<select required value={brief.sound} onChange={e => change("sound", e.target.value)}>
            <option value="">{c("Choose a direction", "เลือกแนวทาง")}</option>
            {[c("Warm & relaxed", "อบอุ่นและผ่อนคลาย"), c("Social & upbeat", "สดใสและเป็นกันเอง"), c("Dancefloor energy", "สนุกบนฟลอร์เต้นรำ"), c("Let’s find the right sound together", "ช่วยเลือกแนวที่เหมาะให้เรา")].map(value => <option key={value}>{value}</option>)}
          </select></label>
          <label className={styles.fullWidth}>{c("Anything else we should know? (optional)", "มีรายละเอียดอื่นเพิ่มเติมไหม? (ไม่บังคับ)")}<textarea rows={3} maxLength={500} value={brief.details} onChange={e => change("details", e.target.value)} placeholder={c("Budget range, favourite artists, equipment on site, or anything to avoid.", "งบประมาณ ศิลปินที่ชอบ อุปกรณ์ที่มี หรือสิ่งที่ต้องการหลีกเลี่ยง")} /></label>
          <label>{c("Your name", "ชื่อของคุณ")}<input required autoComplete="name" maxLength={80} value={brief.name} onChange={e => change("name", e.target.value)} /></label>
          <label>{c("Your email", "อีเมลของคุณ")}<input required type="email" autoComplete="email" maxLength={150} value={brief.email} onChange={e => change("email", e.target.value.trim())} /></label>
        </div>
        <div className={formStyles.honeypot} aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} /></label></div>
        <button className={styles.primary} type="submit">{submitting ? c("Sending your enquiry…", "กำลังส่งคำสอบถาม…") : c("Send my enquiry", "ส่งคำสอบถาม")}<span aria-hidden>↗</span></button>
      </fieldset>
      <p className={styles.formNote}>{c("This is an enquiry, not a confirmed booking. Dates, artists and fees are agreed with our team. We use these details to respond to your request.", "นี่เป็นการสอบถาม ยังไม่ใช่การยืนยันจอง กรุณาตกลงวัน ศิลปิน และค่าบริการกับทีมงาน เราใช้ข้อมูลนี้เพื่อตอบคำสอบถามของคุณ")} <a href="/privacy">{c("Privacy", "ความเป็นส่วนตัว")}</a></p>
      <p className={styles.copyStatus} role={failed ? "alert" : "status"} aria-live="polite">{status}</p>
      {receipt && <div className={formStyles.receipt} ref={receiptBox} tabIndex={-1}>
        <span aria-hidden="true">✓</span><h3>{c("Your brief is with Bright Ears.", "Bright Ears ได้รับบรีฟของคุณแล้ว")}</h3>
        <p>{c("Keep this reference for your conversation with our team.", "เก็บหมายเลขอ้างอิงนี้ไว้สำหรับติดต่อกับทีมงาน")}</p><code>{receipt}</code>
        <button type="button" className={styles.textLink} onClick={() => { setReceipt(""); setStatus(""); submissionKey.current = null; }}>{c("Start another enquiry", "เริ่มคำสอบถามใหม่")} ↗</button>
      </div>}
      <details className={formStyles.alternatives} open={failed || undefined}>
        <summary>{c("Or share your brief by LINE or email", "หรือส่งบรีฟทาง LINE หรืออีเมล")}</summary>
        <div className={styles.briefResult}><label htmlFor="prepared-brief">{c("Your music brief", "บรีฟดนตรีของคุณ")}</label>
          <textarea id="prepared-brief" ref={result} readOnly rows={10} value={formatMusicBrief(brief, th)} />
          <div className={styles.resultActions}><button className={styles.secondary} type="button" onClick={copy}>{c("Copy brief", "คัดลอกบรีฟ")}</button><a className={styles.textLink} href="https://page.line.me/944grjuq">LINE ↗</a><a className={styles.textLink} href={briefEmailHref(brief, th)}>{c("Open email draft", "เปิดร่างอีเมล")} ↗</a></div>
          <p className={styles.formNote}>{c("Email opens your mail app. You can also write to info@brightears.io.", "อีเมลจะเปิดแอปอีเมลของคุณ หรือติดต่อ info@brightears.io")}</p>
        </div>
      </details>
    </form>
  </div>;
}
