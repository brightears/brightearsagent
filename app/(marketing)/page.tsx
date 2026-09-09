import type { Metadata } from "next";
import Image from "next/image";
import { getRequestLocale } from "@/lib/i18n/server";
import { organizationJsonLd } from "@/lib/marketing/site";
import { AgencyBrief } from "@/components/agency-brief";
import { AgencySound } from "@/components/agency-sound";
import styles from "./agency.module.css";

export const metadata: Metadata = {
  title: "Bright Ears — DJs & music for Bangkok venues and events",
  alternates: {canonical:"/"},
  description: "DJs and music programming for hotels, restaurants, rooftops and private events. Tell Bright Ears about your venue and the night you have in mind.",
  openGraph: { title: "Bright Ears — Good music. Great nights.", description: "DJs and music programming for Bangkok venues and events.", images: [] },
  twitter: { card: "summary", title: "Bright Ears — Good music. Great nights.", images: [] },
};
export default async function HomePage({searchParams}:{searchParams:Promise<{artist?:string}>}) {
  const requestedArtist=(await searchParams).artist;
  const initialArtist=["UFO","RabbitDisco","Benji"].includes(requestedArtist || "") ? requestedArtist || "" : "";
  const th = (await getRequestLocale()) === "th";
  return <div className={styles.home}>
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd()).replace(/</g, "\\u003c") }} />
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}><span />{th ? "ดีเจเอเจนซี · กรุงเทพฯ" : "Independent DJ agency · Bangkok"}</p>
        <h1 id="hero-title" className={styles.heroTitle}>{th ? "ดนตรีที่ใช่." : "Good music."}<br /><em>{th ? "ค่ำคืนที่ดี." : "Great nights."}</em></h1>
        <p className={styles.heroIntro}>{th ? "ดีเจและการวางโปรแกรมดนตรีสำหรับโรงแรม ร้านอาหาร และอีเวนต์ เลือกเสียงดนตรีให้เข้ากับสถานที่ แขก และบรรยากาศที่คุณต้องการ" : "DJs and music programming for hotels, restaurants and events. The right sound for your space, your guests and the night you have in mind."}</p>
        <div className={styles.heroActions}><a className={styles.primary} href="#brief">{th ? "วางแผนดนตรีของคุณ" : "Let’s plan your music"}<span aria-hidden>↗</span></a><a className={styles.textLink} href="#artists">{th ? "รู้จักดีเจของเรา" : "Meet the DJs"}<span aria-hidden>↓</span></a></div>
        <div className={styles.heroNote}>{th ? "ตั้งแต่ดินเนอร์สบาย ๆ จนถึงเพลงสุดท้ายบนฟลอร์" : "From the first drink to the last track."}</div>
      </div>
      <figure className={styles.heroVisual}>
        <Image src="/agency/ufo-photo1.png" alt={th ? "DJ UFO เล่นดนตรีที่โต๊ะดีเจ" : "DJ UFO at the decks"} fill sizes="(max-width: 800px) 100vw, 48vw" preload className={styles.heroImage} />
        <div className={styles.photoCorner} aria-hidden>BE / SELECTED</div>
        <figcaption><span>{th ? "หลังบูธดีเจ" : "Behind the decks"}</span><strong>DJ UFO</strong><span aria-hidden>↗</span></figcaption>
      </figure>
    </section>
    <div className={styles.serviceStrip}><span>{th ? "โรงแรมและรูฟท็อป" : "Hotels & rooftops"}</span><span aria-hidden> / </span><span>{th ? "ร้านอาหารและบาร์" : "Restaurants & bars"}</span><span aria-hidden> / </span><span>{th ? "งานส่วนตัวและแบรนด์อีเวนต์" : "Private & brand events"}</span></div>
    <section id="approach" className={styles.section} aria-labelledby="approach-title">
      <div className={styles.sectionHeading}><p className={styles.eyebrow}><span />{th ? "ฟัง เข้าใจ แล้วเลือกดนตรี" : "A feel for the room"}</p><h2 id="approach-title">{th ? "ทุกสถานที่" : "Every room"}<br /><em>{th ? "มีจังหวะของตัวเอง." : "has a rhythm."}</em></h2><p>{th ? "ดนตรีที่ดีเริ่มจากการเข้าใจสถานที่และผู้คน เราช่วยเลือกดีเจและวางแนวดนตรีให้เข้ากับเวลาของวันและบรรยากาศของคุณ" : "A great set starts with understanding the room. We bring together the artist, the music and the moment—whether you need one memorable evening or a regular programme."}</p></div>
      <div className={styles.offerRows}>
        <article><span className={styles.offerNumber}>01</span><div><h3>{th ? "ดีเจสำหรับงานของคุณ" : "One occasion. The right DJ."}</h3><p>{th ? "งานส่วนตัว งานแบรนด์ และงานเปิดตัว บอกวัน สถานที่ และแขกของคุณ แล้วเราจะช่วยเลือกศิลปินที่เหมาะ" : "Private celebrations, brand events and venue openings. Tell us about the occasion and we’ll help find an artist who fits."}</p></div><a href="#brief" aria-label={th ? "สอบถามดีเจสำหรับงาน" : "Inquire about an event DJ"}>↗</a></article>
        <article><span className={styles.offerNumber}>02</span><div><h3>{th ? "ดนตรีประจำสถานที่" : "A regular sound for your venue."}</h3><p>{th ? "เลือกศิลปิน วางตาราง และกำหนดแนวดนตรีสำหรับโรงแรม ร้านอาหาร และบาร์ พร้อมปรับตามความคิดเห็นของทีมคุณ" : "Artist selection, scheduling and music direction for hotels, restaurants and bars, with feedback from your team shaping the programme."}</p></div><a href="#brief" aria-label={th ? "สอบถามโปรแกรมดนตรีประจำ" : "Inquire about a regular music programme"}>↗</a></article>
      </div>
      <div className={styles.venueExperience}><p className={styles.eyebrow}>{th ? "ประสบการณ์ในสถานที่และโรงแรม รวมถึง" : "Venue experience includes"}</p><div><span>NOBU</span><span>Marriott Hotels</span><span>Hilton Hotels</span></div></div>
    </section>
    <section className={styles.soundSection} aria-labelledby="sound-title"><div className={styles.compactHeading}><p className={styles.eyebrow}><span />{th ? "เริ่มจากบรรยากาศ" : "Start with a feeling"}</p><h2 id="sound-title">{th ? "คืนนี้ควรรู้สึกอย่างไร?" : "How should the night feel?"}</h2><p>{th ? "ลองเลือกแนวทาง แล้วค่อยปรับให้เป็นเสียงของสถานที่คุณ" : "Explore a starting point. We’ll shape the details around your space."}</p></div><AgencySound th={th} /></section>
    <section id="artists" className={styles.section} aria-labelledby="artists-title"><div className={styles.artistsHeading}><div><p className={styles.eyebrow}><span />{th ? "คนที่อยู่เบื้องหลังเสียงดนตรี" : "The people behind the music"}</p><h2 id="artists-title">{th ? "เลือกด้วยหู." : "Selected by ear."}<br /><em>{th ? "เล่นด้วยใจ." : "Played with feeling."}</em></h2></div><p>{th ? "พบกับดีเจบางส่วนของ Bright Ears เราจะช่วยเลือกศิลปินให้เข้ากับบรีฟและวันจัดงานของคุณ" : "A few faces from Bright Ears. We’ll recommend a lineup around your brief and the artists available for your dates."}</p></div>
      <div className={styles.artistsGrid}>{[{name:"UFO",image:"ufo-photo1.png",number:"01"},{name:"RabbitDisco",image:"rabbitdisco-photo1.png",number:"02"},{name:"Benji",image:"benji-photo1.png",number:"03"}].map(artist => <article key={artist.name}><a href={"/?artist=" + encodeURIComponent(artist.name) + "#brief"} aria-label={(th ? "สอบถามเกี่ยวกับ " : "Inquire about ") + artist.name}><div className={styles.artistPhoto}><Image src={"/agency/" + artist.image} alt={"DJ " + artist.name} fill sizes="(max-width: 600px) 88vw, (max-width: 900px) 42vw, 28vw" /><span>{artist.number} / BRIGHT EARS</span></div><div className={styles.artistCaption}><h3>{artist.name}</h3><span aria-hidden>↗</span></div></a></article>)}</div>
    </section>
    <aside className={styles.breezeBand}><div><p className={styles.eyebrow}>{th ? "นอกเหนือจากช่วงดีเจ" : "Between the live sets"}</p><h2>{th ? "ดนตรีสำหรับทั้งวัน." : "Music for the rest of the day."}</h2><p>{th ? "สำรวจ Beat Breeze โดย BMAsia Music สำหรับเพลงเปิดในธุรกิจและการจัดตารางดนตรีในแต่ละโซน ตั้งแต่เปิดร้านจนถึงเวลาปิด" : "Explore Beat Breeze by BMAsia Music for business music and zone scheduling, from opening time to the last guest."}</p></div><a href="https://beatbreeze.io" className={styles.secondary}>{th ? "รู้จัก Beat Breeze" : "Explore Beat Breeze"} <span aria-hidden>↗</span></a></aside>
    <section id="brief" className={styles.briefSection} aria-label={th ? "เตรียมบรีฟดนตรี" : "Prepare a music brief"}><AgencyBrief key={initialArtist} th={th} initialArtist={initialArtist} /></section>
  </div>;
}
