import type { Metadata } from "next";
import Link from "next/link";
import { ArtistApplicationForm } from "@/components/artist-application-form";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizedPath } from "@/lib/i18n/routing";
import { localizedPageMeta } from "@/lib/marketing/site";
import styles from "../services.module.css";
import join from "./join.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const th = locale === "th";
  return localizedPageMeta({
    path: "/join",
    locale,
    title: th ? "ร่วมงานกับ Bright Ears — สมัครเป็นศิลปิน" : "Play with Bright Ears — artist applications",
    description: th ? "ดีเจ นักดนตรีสด นักร้อง และพิธีกร สมัครร่วมงานกับ Bright Ears สำหรับโรงแรม ร้านอาหาร และงานอีเวนต์ในกรุงเทพฯ และพัทยา" : "DJs, live musicians, singers and MCs: apply to play hotels, restaurants and events in Bangkok and Pattaya with Bright Ears.",
  });
}

export default async function JoinPage() {
  const th = (await getRequestLocale()) === "th";
  const c = (en: string, thai: string) => th ? thai : en;
  return <div className={styles.page} lang={th ? "th" : "en"}>
    <section className={join.hero} aria-labelledby="join-title">
      <div>
        <p className={styles.eyebrow}>{c("FOR DJS, MUSICIANS, SINGERS & MCS", "สำหรับดีเจ นักดนตรี นักร้อง และพิธีกร")}</p>
        <h1 id="join-title">{c("Play with", "ร่วมงานกับ")}<br/><em>Bright Ears.</em></h1>
        <p className={styles.intro}>{c("We book DJs, live musicians, singers and hosts for hotels, restaurants and events in Bangkok and Pattaya. Tell us about your act and send one link we can listen to or watch. We read every application. If your act fits a venue we work with, we will contact you to arrange a paid trial set.", "เราจัดหาดีเจ นักดนตรีสด นักร้อง และพิธีกร ให้โรงแรม ร้านอาหาร และงานอีเวนต์ในกรุงเทพฯ และพัทยา เล่าให้เราฟังเกี่ยวกับการแสดงของคุณ และส่งลิงก์ที่เราฟังหรือดูได้หนึ่งลิงก์ เราอ่านใบสมัครทุกฉบับ หากการแสดงของคุณเหมาะกับสถานที่ที่เราดูแล เราจะติดต่อกลับเพื่อนัดเล่นทดลองแบบมีค่าตอบแทน")}</p>
      </div>
      <aside className={join.panel} aria-label={c("What this form asks for", "สิ่งที่แบบฟอร์มนี้ขอ")}>
        <h2>{c("What we ask for", "สิ่งที่เราขอ")}</h2>
        <ul><li>{c("Your act, sound and the settings you have played", "การแสดง แนวเพลง และสถานที่ที่เคยเล่น")}</li><li>{c("One link to a mix or a live video", "ลิงก์มิกซ์หรือวิดีโอการแสดงสดหนึ่งลิงก์")}</li><li>{c("An email, LINE ID or phone number", "อีเมล LINE ID หรือเบอร์โทรศัพท์")}</li></ul>
        <h2>{c("What we never ask for here", "สิ่งที่เราไม่ขอในแบบฟอร์มนี้")}</h2>
        <ul><li>{c("ID card or passport", "บัตรประชาชนหรือหนังสือเดินทาง")}</li><li>{c("Bank details", "ข้อมูลบัญชีธนาคาร")}</li><li>{c("Date of birth or home address", "วันเกิดหรือที่อยู่บ้าน")}</li></ul>
        <p>{c("Already play with us? Your schedule is in the ", "เล่นกับเราอยู่แล้ว? ดูตารางงานได้ที่ ")}<a href={`https://agency.brightears.io/${th ? "th" : "en"}/dj-portal`}>{c("DJ portal", "พอร์ทัลดีเจ")} ↗</a></p>
      </aside>
    </section>
    <section className={join.formSection} aria-label={c("Artist application", "ใบสมัครศิลปิน")}>
      <ArtistApplicationForm th={th}/>
      <p className={join.alt}>{c("Prefer to talk first? ", "อยากคุยก่อน? ")}<a href="https://page.line.me/944grjuq">{c("Message us on LINE", "ติดต่อเราทาง LINE")} ↗</a> · <Link href={localizedPath("/acts", th ? "th" : "en")}>{c("See the acts we book", "ดูรูปแบบการแสดงที่เราจัด")} ↗</Link></p>
    </section>
  </div>;
}
