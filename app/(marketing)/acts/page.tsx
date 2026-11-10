import type { Metadata } from "next";
import Link from "next/link";
import { AgencyLandingPage } from "@/components/agency-landing-page";
import { BUYER_ACTS } from "@/lib/agency/acts";
import { ACTS } from "@/lib/agency/landing-pages";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizedPath } from "@/lib/i18n/routing";
import { localizedPageMeta } from "@/lib/marketing/site";
import landing from "../landing.module.css";
import styles from "../services.module.css";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const th = locale === "th";
  return localizedPageMeta({
    path: "/acts",
    locale,
    title: th ? "ดีเจ ดนตรีสด นักร้อง และพิธีกร — Bright Ears" : "DJs, live musicians, singers & MCs — Bright Ears",
    description: th ? "ดีเจร่วมกับแซกโซโฟนหรือเพอร์คัชชัน นักดนตรีเดี่ยว นักร้อง วงอะคูสติกและแจ๊ส และพิธีกร สำหรับโรงแรมและงานอีเวนต์ในกรุงเทพฯ และพัทยา" : "DJ with sax or percussion, solo instrumentalists, singers, acoustic and jazz trios, and MCs for hotels and events in Bangkok and Pattaya.",
  });
}

export default async function ActsPage({ searchParams }: { searchParams: Promise<{ act?: string }> }) {
  const [locale, params] = await Promise.all([getRequestLocale(), searchParams]);
  const th = locale === "th";
  const t = (copy: { en: string; th: string }) => th ? copy.th : copy.en;
  const chosen = BUYER_ACTS.find(act => act.id === params.act);
  const config = chosen ? { ...ACTS, brief: { ...ACTS.brief, actType: chosen.enquiry } } : ACTS;
  return <AgencyLandingPage config={config} th={th}>
    <section className={landing.acts} aria-labelledby="acts-title">
      <header><p className={styles.eyebrow}>{th ? "รูปแบบการแสดง" : "ACT FORMATS"}</p><h2 id="acts-title">{th ? "เลือกรูปแบบ" : "Choose a format."}<br/><em>{th ? "แล้วเราเสนอผู้แสดง" : "We propose the performers."}</em></h2><p>{th ? "แต่ละรูปแบบด้านล่างคือสิ่งที่เราวางขอบเขตและเสนอราคาให้ได้ ศิลปินที่ว่างขึ้นอยู่กับวันที่ของคุณ" : "Each format below is something we can scope and quote. Which performers are free depends on your date."}</p></header>
      <ul className={landing.actGrid}>{BUYER_ACTS.map((act, i) => <li key={act.id} className={landing.actCard} data-reveal>
        <span aria-hidden="true">0{i + 1}</span>
        <h3>{t(act.name)}</h3>
        <p>{t(act.body)}</p>
        <p className={landing.settings}>{t(act.settings)}</p>
        <Link href={localizedPath(`/acts?act=${act.id}#brief`, locale)}>{th ? "สอบถามรูปแบบนี้" : "Ask about this format"} <span aria-hidden>↗</span></Link>
      </li>)}</ul>
    </section>
    <aside className={landing.join} aria-labelledby="join-title">
      <div><h2 id="join-title">{th ? "เป็นนักดนตรี นักร้อง หรือพิธีกร?" : "Musician, singer or MC?"}</h2><p>{th ? "ส่งใบสมัครพร้อมลิงก์ที่เราฟังหรือดูได้ ทีมของเราอ่านทุกใบสมัคร" : "Apply with a link we can listen to or watch. Our team reads every application."}</p></div>
      <Link href={localizedPath("/join", locale)}>{th ? "สมัครร่วมงานกับเรา" : "Apply to perform"} <span aria-hidden>↗</span></Link>
    </aside>
  </AgencyLandingPage>;
}
