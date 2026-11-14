import type { Metadata } from "next";
import Link from "next/link";
import { ArtistApplicationForm } from "@/components/artist-application-form";
import { getRequestLocale } from "@/lib/i18n/server";
import styles from "../services.module.css";
import join from "./join.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const th = (await getRequestLocale()) === "th";
  return {
    title: th ? "ร่วมงานกับ Bright Ears — สมัครเป็นศิลปิน" : "Play with Bright Ears — artist applications",
    description: th ? "ดีเจ นักดนตรีสด นักร้อง และพิธีกร สมัครเข้าแคตตาล็อกของ Bright Ears ได้ฟรีและไม่ผูกขาด Bright Ears เป็นเอเจนซีในกรุงเทพฯ สำหรับโรงแรม ร้านอาหาร และงานอีเวนต์" : "DJs, live musicians, singers and MCs: join the Bright Ears catalogue, free and non-exclusive. Bright Ears is a Bangkok agency for hotels, restaurants and events.",
    alternates: { canonical: "/join" },
  };
}

export default async function JoinPage() {
  const th = (await getRequestLocale()) === "th";
  const c = (en: string, thai: string) => th ? thai : en;
  return <div className={styles.page} lang={th ? "th" : "en"}>
    <section className={join.hero} aria-labelledby="join-title">
      <div>
        <p className={styles.eyebrow}>{c("FOR DJS, MUSICIANS, SINGERS & MCS", "สำหรับดีเจ นักดนตรี นักร้อง และพิธีกร")}</p>
        <h1 id="join-title">{c("Play with", "ร่วมงานกับ")}<br/><em>Bright Ears.</em></h1>
        <p className={styles.intro}>{c("Bright Ears is a Bangkok agency. We book DJs, live musicians, singers and hosts for hotels, restaurants and events. Tell us about your act and send one link we can listen to or watch.", "Bright Ears เป็นเอเจนซีในกรุงเทพฯ เราจัดหาดีเจ นักดนตรีสด นักร้อง และพิธีกร ให้โรงแรม ร้านอาหาร และงานอีเวนต์ เล่าให้เราฟังเกี่ยวกับการแสดงของคุณ และส่งลิงก์ที่เราฟังหรือดูได้หนึ่งลิงก์")}</p>
        <section className={join.how} aria-labelledby="join-how">
          <h2 id="join-how">{c("How this works", "เราทำงานอย่างไร")}</h2>
          <ul>
            <li>{c("Joining is free and non-exclusive. You can keep working with anyone.", "สมัครฟรีและไม่ผูกขาด คุณยังรับงานกับใครก็ได้ตามปกติ")}</li>
            <li>{c("Neither side commits to anything, and we cannot guarantee bookings.", "ทั้งสองฝ่ายไม่มีข้อผูกมัดใด ๆ และเราไม่สามารถรับประกันงานได้")}</li>
            <li>{c("If you tick the profile box at the end of the form, we show your profile to the venues and event planners we work with, introduce you when a request fits, and list you in the catalogue buyers browse on brightears.io.", "หากคุณเลือกช่องโปรไฟล์ท้ายแบบฟอร์ม เราจะนำโปรไฟล์ของคุณไปเสนอให้สถานที่และผู้จัดงานที่เราทำงานด้วย แนะนำคุณเมื่อมีงานที่เหมาะ และแสดงคุณในแคตตาล็อกที่ลูกค้าเปิดดูได้บน brightears.io")}</li>
            <li>{c("Your fees are for us only. They never appear on your profile.", "ค่าตัวของคุณใช้ภายใน Bright Ears เท่านั้น และจะไม่แสดงบนโปรไฟล์")}</li>
            <li>{c("You can ask us to remove your profile at any time.", "คุณขอให้เราลบโปรไฟล์ออกได้ทุกเมื่อ")}</li>
          </ul>
        </section>
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
      <p className={join.alt}>{c("Prefer to talk first? ", "อยากคุยก่อน? ")}<a href="https://page.line.me/944grjuq">{c("Message us on LINE", "ติดต่อเราทาง LINE")} ↗</a> · <Link href="/acts">{c("See the acts we book", "ดูรูปแบบการแสดงที่เราจัด")} ↗</Link></p>
    </section>
  </div>;
}
