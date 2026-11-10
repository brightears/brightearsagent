"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { ACT_TYPE_LABELS } from "@/lib/agency/acts";
import {
  ACT_TYPES, CHANNELS, CITIES, EQUIPMENT, FEES, FREE_TEXT_FIELDS, GENRES, HEARD_FROM, LANGUAGES, NIGHTS,
  RIGHT_TO_WORK, SET_LENGTHS, SETTINGS, TRAVEL, YEARS, applicationFieldsSchema, applicationIssues, containsThaiIdNumber,
} from "@/lib/agency/application-contract";
import { preparePhoto } from "@/lib/agency/photo-resize";
import agency from "@/app/(marketing)/agency.module.css";
import styles from "./artist-application.module.css";

type Label = { en: string; th: string };
type Fields = {
  act_name: string; contact_name: string; act_type: string; instrument_or_role: string; members: string; base_city: string;
  travel: string[]; languages: string[]; years_performing: string; genres: string[]; genres_other: string; settings_played: string[];
  venues_played: string; set_lengths: string[]; own_equipment: string[]; bio: string; mix_or_video_url: string; instagram_url: string;
  facebook_url: string; soundcloud_url: string; mixcloud_url: string; youtube_url: string; website_url: string; photo_credit: string;
  available_nights: string[]; earliest_start: string; expected_fee_per_hour_thb: string; right_to_work: string; email: string;
  line_id: string; phone: string; preferred_channel: string; heard_from: string; referred_by: string; consent_age: boolean; consent_data: boolean;
};
const EMPTY: Fields = {
  act_name: "", contact_name: "", act_type: "", instrument_or_role: "", members: "1", base_city: "", travel: [], languages: [], years_performing: "",
  genres: [], genres_other: "", settings_played: [], venues_played: "", set_lengths: [], own_equipment: [], bio: "", mix_or_video_url: "",
  instagram_url: "", facebook_url: "", soundcloud_url: "", mixcloud_url: "", youtube_url: "", website_url: "", photo_credit: "",
  available_nights: [], earliest_start: "", expected_fee_per_hour_thb: "", right_to_work: "", email: "", line_id: "", phone: "",
  preferred_channel: "", heard_from: "", referred_by: "", consent_age: false, consent_data: false,
};
type ListKey = { [K in keyof Fields]: Fields[K] extends string[] ? K : never }[keyof Fields];
type TextKey = { [K in keyof Fields]: Fields[K] extends string ? K : never }[keyof Fields];

export function ArtistApplicationForm({ th }: { th: boolean }) {
  const c = (en: string, thai: string) => th ? thai : en;
  const l = (label: Label) => th ? label.th : label.en;
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState("");
  const [preparingPhoto, setPreparingPhoto] = useState(false);
  const [photoNotStored, setPhotoNotStored] = useState(false);
  const [errors, setErrors] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState("");
  const [receipt, setReceipt] = useState("");
  const [website, setWebsite] = useState("");
  const submissionKey = useRef<string | null>(null);
  const done = useRef<HTMLDivElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  function set<K extends keyof Fields>(key: K, value: Fields[K]) {
    setFields(previous => ({ ...previous, [key]: value }));
    submissionKey.current = null;
    setErrors(previous => { const next = new Set(previous); next.delete(key); if (["email", "line_id", "phone"].includes(key)) next.delete("contact"); return next; });
    setStatus("");
  }
  function toggle(key: ListKey, value: string, max: number) {
    const list = fields[key];
    set(key, list.includes(value) ? list.filter(item => item !== value) : list.length < max ? [...list, value] : list);
  }
  async function choosePhoto(file: File | null) {
    setPhotoError(""); submissionKey.current = null; setPhoto(null);
    if (!file) return;
    setPreparingPhoto(true);
    const prepared = await preparePhoto(file);
    setPreparingPhoto(false);
    if ("error" in prepared) {
      if (photoInput.current) photoInput.current.value = "";
      setPhotoError(prepared.error === "type"
        ? c("Use one JPG, PNG or WebP photo.", "ใช้รูป JPG, PNG หรือ WebP หนึ่งไฟล์")
        : c("This photo is too large. Choose a smaller one.", "รูปภาพนี้มีขนาดใหญ่เกินไป โปรดเลือกรูปที่เล็กกว่านี้"));
      return;
    }
    setPhoto(prepared.file);
  }

  const idWarnings = FREE_TEXT_FIELDS.filter(key => containsThaiIdNumber(fields[key]));
  function payloadFields() {
    return { ...fields, members: Number(fields.members) };
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || receipt || preparingPhoto) return;
    const parsed = applicationFieldsSchema.safeParse(payloadFields());
    if (!parsed.success || photoError) {
      const bad = new Set(parsed.success ? [] : applicationIssues(parsed.error).map(issue => issue.field));
      // Zod skips the cross-field checks while basic fields fail; show the contact rule at once.
      if (!fields.email.trim() && !fields.line_id.trim() && !fields.phone.trim()) bad.add("contact");
      setErrors(bad);
      setStatus(bad.has("contact")
        ? c("Add an email, a LINE ID or a phone number so we can reach you.", "เพิ่มอีเมล LINE ID หรือเบอร์โทรศัพท์ อย่างน้อยหนึ่งช่องทาง")
        : idWarnings.length ? c("Remove the ID number before sending.", "โปรดลบเลขบัตรประชาชนก่อนส่ง")
        : c("Please check the highlighted fields.", "โปรดตรวจสอบช่องที่ไฮไลต์"));
      requestAnimationFrame(() => document.querySelector<HTMLElement>("[data-invalid=true] input, [data-invalid=true] select, [data-invalid=true] textarea")?.focus());
      return;
    }
    setSubmitting(true); setStatus("");
    submissionKey.current ??= crypto.randomUUID();
    const query = new URLSearchParams(window.location.search);
    const utm = Object.fromEntries(["source", "medium", "campaign", "term", "content"].flatMap(key => { const value = query.get("utm_" + key)?.slice(0, 100); return value ? [[key, value]] : []; }));
    const form = new FormData();
    form.set("payload", JSON.stringify({ submissionKey: submissionKey.current, locale: th ? "th" : "en", website, sourcePath: window.location.pathname.slice(0, 200), utm, application: payloadFields() }));
    if (photo) form.set("photo", photo);
    try {
      const response = await fetch("/api/agency/applications", { method: "POST", body: form, signal: AbortSignal.timeout(60000) });
      const body = await response.json();
      if (!response.ok || body.ok !== true || typeof body.reference !== "string") {
        if (response.status === 409) submissionKey.current = null;
        if (Array.isArray(body.fields)) setErrors(new Set(body.fields));
        throw new Error(body.error === "id_number" ? "id" : response.status === 429 ? "limit" : response.status === 400 || response.status === 413 || response.status === 415 ? "invalid" : "unavailable");
      }
      setPhotoNotStored(body.photo === "not_stored");
      setReceipt(body.reference);
      requestAnimationFrame(() => { done.current?.focus(); done.current?.scrollIntoView({ block: "center" }); });
    } catch (error) {
      const kind = error instanceof Error ? error.message : "";
      setStatus(kind === "id" ? c("Remove the ID number before sending.", "โปรดลบเลขบัตรประชาชนก่อนส่ง")
        : kind === "invalid" ? c("Please check the form and the photo, then send again.", "โปรดตรวจสอบแบบฟอร์มและรูปภาพ แล้วส่งอีกครั้ง")
        : kind === "limit" ? c("Too many attempts from this connection. Please try again in an hour.", "มีการส่งจากเครือข่ายนี้หลายครั้งเกินไป โปรดลองอีกครั้งในอีกหนึ่งชั่วโมง")
        : c("We couldn’t save your application just now. Your details are still here. Try again later, or message us on LINE.", "ยังบันทึกใบสมัครไม่ได้ในขณะนี้ ข้อมูลของคุณยังอยู่ โปรดลองอีกครั้งภายหลัง หรือติดต่อเราทาง LINE"));
    } finally { setSubmitting(false); }
  }

  if (receipt) {
    const channel = CHANNELS[fields.preferred_channel as keyof typeof CHANNELS];
    return <div className={styles.done} ref={done} tabIndex={-1} role="status">
      <span aria-hidden="true">✓</span>
      <h2>{c("Thanks, we have your application.", "ขอบคุณ เราได้รับใบสมัครของคุณแล้ว")}</h2>
      <p>{th
        ? `เราอ่านใบสมัครทุกฉบับ โดยปกติภายในหนึ่งสัปดาห์ หากการแสดงของคุณเหมาะกับสถานที่ที่เราดูแล เราจะติดต่อผ่าน ${channel ? l(channel) : "ช่องทางที่เลือก"} หากไม่ได้รับการติดต่อ หมายความว่าขณะนี้ยังไม่มีตำแหน่งที่เหมาะสม และเราจะเก็บใบสมัครไว้ 12 เดือน`
        : `We read every one, usually within a week. If your act fits a venue we work with, we will contact you through ${channel ? l(channel) : "the channel you chose"}. If you do not hear from us, we have no suitable slot right now and will keep your application for 12 months.`}</p>
      {photoNotStored && <p>{c("Your photo was not saved. We will ask for one if we need it.", "ระบบไม่ได้บันทึกรูปภาพของคุณ หากต้องการ เราจะขอรูปภาพจากคุณภายหลัง")}</p>}
      <code>{receipt}</code>
    </div>;
  }

  const invalid = (key: string) => errors.has(key) || (FREE_TEXT_FIELDS as readonly string[]).includes(key) && idWarnings.includes(key as typeof idWarnings[number]);
  const idNote = (key: TextKey) => idWarnings.includes(key as typeof idWarnings[number]) && <span className={styles.warning} role="alert">{c("This looks like a Thai ID number. Remove it: we never need ID on this form.", "ข้อความนี้ดูเหมือนเลขบัตรประชาชน โปรดลบออก แบบฟอร์มนี้ไม่ต้องใช้ข้อมูลบัตรประชาชน")}</span>;
  const field = (key: TextKey, label: string, input: ReactNode, hint?: string, wide = false) =>
    <label key={key} className={wide ? styles.wide : undefined} data-invalid={invalid(key) || undefined}>{label}{hint && <small>{hint}</small>}{input}{idNote(key)}</label>;
  const text = (key: TextKey, label: string, opts: { max: number; type?: string; hint?: string; placeholder?: string; required?: boolean; wide?: boolean; autoComplete?: string } = { max: 80 }) =>
    field(key, label, <input type={opts.type ?? "text"} maxLength={opts.max} required={opts.required} placeholder={opts.placeholder} autoComplete={opts.autoComplete ?? "off"} value={fields[key] as string} aria-invalid={invalid(key) || undefined} onChange={event => set(key, event.target.value)}/>, opts.hint, opts.wide);
  const area = (key: TextKey, label: string, max: number, hint?: string) =>
    field(key, label, <textarea rows={4} maxLength={max} value={fields[key] as string} aria-invalid={invalid(key) || undefined} onChange={event => set(key, event.target.value)}/>, hint, true);
  const select = (key: TextKey, label: string, values: Record<string, Label>, opts: { required?: boolean; hint?: string; prompt?: string } = {}) =>
    field(key, label, <select required={opts.required} value={fields[key] as string} aria-invalid={invalid(key) || undefined} onChange={event => set(key, event.target.value)}>
      <option value="">{opts.prompt ?? c("Choose", "เลือก")}</option>
      {Object.entries(values).map(([value, name]) => <option key={value} value={value}>{l(name)}</option>)}
    </select>, opts.hint);
  const chips = (key: ListKey, label: string, values: Record<string, Label>, max: number, hint?: string) =>
    <fieldset key={key} className={styles.chips} data-invalid={errors.has(key) || undefined}><legend>{label}{hint && <small>{hint}</small>}</legend>
      <div>{Object.entries(values).map(([value, name]) => <label key={value}><input type="checkbox" checked={fields[key].includes(value)} onChange={() => toggle(key, value, max)} disabled={!fields[key].includes(value) && fields[key].length >= max}/><span>{l(name)}</span></label>)}</div>
    </fieldset>;
  const optional = c(" (optional)", " (ไม่บังคับ)");

  return <form className={styles.form} onSubmit={submit} noValidate aria-busy={submitting}>
    <fieldset disabled={submitting} className={styles.reset}>
      <section className={styles.group} aria-labelledby="apply-act"><h2 id="apply-act"><span>01</span>{c("Your act", "การแสดงของคุณ")}</h2><div className={styles.grid}>
        {text("act_name", c("Stage or act name", "ชื่อในวงการ / ชื่อวง"), { max: 80, required: true })}
        {text("contact_name", c("Contact name", "ชื่อผู้ติดต่อ"), { max: 80, required: true, hint: c("The name we should use when we contact you.", "ชื่อที่ให้เราใช้เรียกเมื่อติดต่อคุณ"), autoComplete: "name" })}
        {select("act_type", c("Type of act", "ประเภทการแสดง"), Object.fromEntries(ACT_TYPES.map(type => [type, ACT_TYPE_LABELS[type]])), { required: true })}
        {text("instrument_or_role", c("Instrument or role", "เครื่องดนตรี / บทบาท") + (fields.act_type === "dj" || !fields.act_type ? optional : ""), { max: 120, placeholder: c("e.g. alto sax, piano and vocals, MC in Thai and English", "เช่น อัลโตแซกโซโฟน เปียโนและร้อง พิธีกรภาษาไทยและอังกฤษ") })}
        {field("members", c("Members in the act", "จำนวนสมาชิก"), <input type="number" min={1} max={12} inputMode="numeric" value={fields.members} onChange={event => set("members", event.target.value)}/>, c("Band members do not apply separately.", "สมาชิกในวงไม่ต้องสมัครแยก"))}
        {select("base_city", c("Where you are based", "พื้นที่ที่คุณประจำอยู่"), CITIES, { required: true })}
        {select("years_performing", c("Years performing", "ประสบการณ์การแสดง"), YEARS, { required: true })}
      </div>
        {chips("travel", c("Where you can travel to perform", "พื้นที่ที่สะดวกเดินทางไปแสดง") + optional, TRAVEL, 7)}
        {chips("languages", c("Languages you perform or host in", "ภาษาที่ใช้ในการแสดง") + optional, LANGUAGES, 6)}
      </section>

      <section className={styles.group} aria-labelledby="apply-music"><h2 id="apply-music"><span>02</span>{c("Music and settings", "แนวเพลงและสถานที่")}</h2>
        {chips("genres", c("Genres", "แนวเพลง"), GENRES, 6, c("Up to six.", "เลือกได้สูงสุด 6"))}
        <div className={styles.grid}>{text("genres_other", c("Other genres", "แนวเพลงอื่น") + optional, { max: 120, wide: true })}</div>
        {chips("settings_played", c("Settings you have played", "เคยเล่นในงานแบบใด"), SETTINGS, 12)}
        <div className={styles.grid}>
          {area("venues_played", c("Venues or events you have played", "สถานที่หรืองานที่เคยเล่น") + optional, 400, c("Up to five from the last two years, names only.", "ไม่เกิน 5 แห่งในช่วงสองปีที่ผ่านมา ระบุเฉพาะชื่อ"))}
          {area("bio", c("Short bio", "ประวัติสั้น ๆ") + optional, 600, c("40 to 600 characters, in your own words. We may edit it before we use it.", "40–600 ตัวอักษร เขียนด้วยคำของคุณเอง เราอาจปรับแก้ก่อนนำไปใช้"))}
        </div>
        {chips("set_lengths", c("Set lengths you can play", "ความยาวเซ็ตที่เล่นได้") + optional, SET_LENGTHS, 7)}
        {chips("own_equipment", c("Equipment you bring", "อุปกรณ์ที่มีเอง") + optional, EQUIPMENT, 7)}
      </section>

      <section className={styles.group} aria-labelledby="apply-proof"><h2 id="apply-proof"><span>03</span>{c("Let us hear you", "ให้เราได้ฟังผลงาน")}</h2><div className={styles.grid}>
        {text("mix_or_video_url", c("Your best link", "ลิงก์ผลงานที่ดีที่สุด"), { max: 300, type: "url", required: true, wide: true, placeholder: "https://", hint: c("One link that best shows a live set or a recent mix: YouTube, SoundCloud, Mixcloud, Instagram, Facebook, Google Drive or your website.", "ลิงก์เดียวที่แสดงการเล่นสดหรือมิกซ์ล่าสุดได้ดีที่สุด เช่น YouTube, SoundCloud, Mixcloud, Instagram, Facebook, Google Drive หรือเว็บไซต์ของคุณ") })}
        {text("instagram_url", "Instagram" + optional, { max: 300, type: "url", placeholder: "https://instagram.com/…" })}
        {text("facebook_url", "Facebook" + optional, { max: 300, type: "url", placeholder: "https://facebook.com/…" })}
        {text("soundcloud_url", "SoundCloud" + optional, { max: 300, type: "url", placeholder: "https://soundcloud.com/…" })}
        {text("mixcloud_url", "Mixcloud" + optional, { max: 300, type: "url", placeholder: "https://mixcloud.com/…" })}
        {text("youtube_url", "YouTube" + optional, { max: 300, type: "url", placeholder: "https://youtube.com/…" })}
        {text("website_url", c("Website", "เว็บไซต์") + optional, { max: 300, type: "url", placeholder: "https://" })}
        <label className={styles.wide} data-invalid={!!photoError || undefined}>{c("Photo", "รูปภาพ") + optional}<small>{c("One JPG, PNG or WebP. The form makes it smaller before sending. Only our talent team sees it.", "รูป JPG, PNG หรือ WebP หนึ่งไฟล์ แบบฟอร์มจะย่อขนาดรูปก่อนส่ง เฉพาะทีมคัดเลือกศิลปินเท่านั้นที่เห็น")}</small>
          <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => void choosePhoto(event.target.files?.[0] ?? null)}/>
          {preparingPhoto && <span role="status">{c("Preparing photo…", "กำลังเตรียมรูปภาพ…")}</span>}
          {photoError && <span className={styles.warning} role="alert">{photoError}</span>}
        </label>
        {photo && text("photo_credit", c("Photographer", "ช่างภาพ") + optional, { max: 80, hint: c("If you know who took it.", "หากทราบว่าใครเป็นผู้ถ่าย") })}
      </div></section>

      <section className={styles.group} aria-labelledby="apply-work"><h2 id="apply-work"><span>04</span>{c("Work details", "รายละเอียดการทำงาน")}</h2>
        {chips("available_nights", c("Nights you are usually free", "คืนที่ปกติสะดวก") + optional, NIGHTS, 8)}
        <div className={styles.grid}>
          {text("earliest_start", c("Earliest start date", "เริ่มงานได้ตั้งแต่") + optional, { max: 10, type: "date" })}
          {select("expected_fee_per_hour_thb", c("Expected fee per hour", "ค่าตัวต่อชั่วโมงที่คาดหวัง (ไม่เปิดเผย)") + optional, FEES, { hint: c("For the whole act. Private, never shown on the site.", "สำหรับทั้งวง เป็นข้อมูลส่วนตัว ไม่แสดงบนเว็บไซต์") })}
          {select("right_to_work", c("Right to work in Thailand", "สิทธิ์ทำงานในประเทศไทย (ไม่ต้องแนบเอกสาร)") + optional, RIGHT_TO_WORK, { hint: c("Hotels ask us about this. Do not upload any document.", "โรงแรมมักสอบถามเรื่องนี้ ไม่ต้องอัปโหลดเอกสารใด ๆ") })}
        </div>
      </section>

      <section className={styles.group} aria-labelledby="apply-contact"><h2 id="apply-contact"><span>05</span>{c("How to reach you", "ช่องทางติดต่อ")}</h2>
        <p className={styles.groupNote} data-invalid={errors.has("contact") || undefined}>{c("Give at least one: email, LINE ID or phone.", "กรอกอย่างน้อยหนึ่งช่องทาง: อีเมล LINE ID หรือเบอร์โทรศัพท์")}</p>
        <div className={styles.grid}>
          {text("email", c("Email", "อีเมล"), { max: 150, type: "email", autoComplete: "email" })}
          {text("line_id", "LINE ID", { max: 40 })}
          {text("phone", c("Phone", "เบอร์โทรศัพท์"), { max: 30, type: "tel", autoComplete: "tel", placeholder: c("e.g. 081 234 5678 or +44…", "เช่น 081 234 5678 หรือ +44…") })}
          {select("preferred_channel", c("Best way to contact you", "ช่องทางที่สะดวกให้ติดต่อ"), CHANNELS, { required: true })}
          {select("heard_from", c("How did you hear about us?", "รู้จักเราจาก") + optional, HEARD_FROM)}
          {text("referred_by", c("Referred by", "ชื่อผู้แนะนำ") + optional, { max: 80, hint: c("If a Bright Ears artist sent you, their name.", "หากศิลปินของ Bright Ears แนะนำคุณมา ระบุชื่อ") })}
        </div>
      </section>

      <section className={styles.consent} aria-labelledby="apply-consent"><h2 id="apply-consent" className={styles.srOnly}>{c("Consent", "ความยินยอม")}</h2>
        <p className={styles.never}>{c("Do not send ID cards, passports or bank details with this form. If we work together, we will ask for what we need for payment privately.", "กรุณาอย่าส่งสำเนาบัตรประชาชน หนังสือเดินทาง หรือข้อมูลบัญชีธนาคารมากับแบบฟอร์มนี้ หากได้ร่วมงานกัน เราจะขอข้อมูลที่จำเป็นสำหรับการจ่ายค่าตอบแทนแยกต่างหากผ่านช่องทางส่วนตัว")}</p>
        <label data-invalid={errors.has("consent_age") || undefined}><input type="checkbox" checked={fields.consent_age} onChange={event => set("consent_age", event.target.checked)}/><span>{c("I am 18 or older and I am applying for my own act, or I have the other members’ agreement to apply for it.", "ข้าพเจ้าอายุ 18 ปีขึ้นไป และสมัครในนามการแสดงของข้าพเจ้าเอง หรือได้รับความยินยอมจากสมาชิกคนอื่นในการสมัครครั้งนี้แล้ว")}</span></label>
        <label data-invalid={errors.has("consent_data") || undefined}><input type="checkbox" checked={fields.consent_data} onChange={event => set("consent_data", event.target.checked)}/><span>{th
          ? <>ข้าพเจ้ายินยอมให้ Bright Ears เก็บข้อมูลและลิงก์ในแบบฟอร์มนี้ เพื่อพิจารณาการแสดงของข้าพเจ้าสำหรับงานที่มีค่าตอบแทนในสถานที่และงานอีเวนต์ และติดต่อข้าพเจ้าเกี่ยวกับเรื่องนี้ผ่านช่องทางที่เลือกไว้ Bright Ears จะไม่เผยแพร่ข้อมูลจากแบบฟอร์มนี้ และจะไม่ส่งต่อให้บุคคลภายนอก Bright Ears โดยไม่ถามข้าพเจ้าก่อน หากข้าพเจ้าอัปโหลดรูปภาพ ข้าพเจ้ายืนยันว่ามีสิทธิ์ส่งต่อรูปภาพนั้นได้ Bright Ears จะเก็บใบสมัครไว้ 12 เดือน จากนั้นจะลบออก เว้นแต่ข้าพเจ้าได้เริ่มทำงานกับ Bright Ears ข้าพเจ้าสามารถขอแก้ไขหรือลบใบสมัครได้ตลอดเวลาโดยส่งอีเมลถึง <a href="mailto:info@brightears.io">info@brightears.io</a></>
          : <>I agree that Bright Ears may keep the details and links in this form to assess my act for paid work at venues and events, and to contact me about it through the channel I chose. Bright Ears does not publish anything from this form and does not share it outside Bright Ears without asking me first. If I upload a photo, I confirm I may share it. Bright Ears keeps an application for 12 months and then deletes it unless I start working with Bright Ears. I can ask for my application to be corrected or deleted at any time by writing to <a href="mailto:info@brightears.io">info@brightears.io</a>.</>}</span></label>
        <div className={styles.honeypot} aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={event => setWebsite(event.target.value)}/></label></div>
        <button className={agency.primary} type="submit" disabled={preparingPhoto}>{submitting ? c("Sending your application…", "กำลังส่งใบสมัคร…") : c("Send my application", "ส่งใบสมัคร")}<span aria-hidden>↗</span></button>
        <p className={styles.status} role={status ? "alert" : undefined} aria-live="polite">{status}</p>
        <p className={styles.small}>{c("Sending this form does not create a booking, a trial or a rate. ", "การส่งแบบฟอร์มนี้ยังไม่ใช่การจองงาน การนัดเล่นทดลอง หรือการตกลงค่าตัว ")}<a href="/privacy#artist-applications">{c("Privacy", "ความเป็นส่วนตัว")}</a></p>
      </section>
    </fieldset>
  </form>;
}
