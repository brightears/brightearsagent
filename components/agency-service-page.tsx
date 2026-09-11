import Image from "next/image";
import Link from "next/link";
import { AgencyBrief } from "@/components/agency-brief";
import { AgencyMotion } from "@/components/agency-motion";
import agency from "@/app/(marketing)/agency.module.css";
import styles from "@/app/(marketing)/services.module.css";

type ServiceKind = "venues" | "events";

export function AgencyServicePage({ kind, th }: { kind: ServiceKind; th: boolean }) {
  const venue = kind === "venues";
  const c = (en: string, thai: string) => th ? thai : en;
  const occasion = venue
    ? c("A regular venue programme", "โปรแกรมดนตรีประจำสถานที่")
    : c("A brand or corporate event", "งานแบรนด์หรือองค์กร");
  const title = venue
    ? [c("Your room.", "สถานที่ของคุณ"), c("Its own rhythm.", "จังหวะที่เป็นคุณ")]
    : [c("Your event.", "งานของคุณ"), c("The right lineup.", "ดีเจที่ใช่")];
  const action = venue
    ? c("Discuss your venue programme", "คุยเรื่องโปรแกรมดนตรีของคุณ")
    : c("Request a lineup for your date", "สอบถามดีเจสำหรับวันงาน");
  const steps = venue ? [
    { title: c("A direction for the room", "แนวดนตรีที่เข้ากับสถานที่"), body: c("Tell us about your guests, the setting and the hours you want to shape. We work with you on a musical brief, from dinner and sunset to the later part of the evening.", "บอกเราเรื่องแขก บรรยากาศ และช่วงเวลาที่อยากเติมเสียงดนตรี เราจะช่วยวางบรีฟให้เหมาะ ตั้งแต่มื้อค่ำและช่วงพระอาทิตย์ตกไปจนถึงช่วงดึก") },
    { title: c("People who fit the brief", "เลือกดีเจให้ตรงกับบรีฟ"), body: c("Explore our roster, or ask us for a selection. We agree the artists, performance times and any cover arrangements with you before the programme begins.", "เลือกจากรายชื่อดีเจ หรือให้เราช่วยเสนอศิลปินที่เหมาะสม เราตกลงเรื่องดีเจ เวลาแสดง และแนวทางจัดหาดีเจแทนก่อนเริ่มโปรแกรม") },
    { title: c("One team to coordinate", "ประสานงานผ่านทีมเดียว"), body: c("We coordinate the agreed schedule and artist communication. Your team can view and download its programme through the venue portal, with paperwork handled alongside the music.", "เราประสานตารางที่ตกลงไว้และสื่อสารกับดีเจ ทีมสถานที่ดูและดาวน์โหลดตารางผ่านพอร์ทัลได้ พร้อมประสานงานเอกสารไปด้วยกัน") },
    { title: c("Feedback, right on LINE", "ส่งความคิดเห็นผ่าน LINE"), body: c("After a performance, venue managers can tap a 1–5 star rating in LINE and add a comment if they wish. That feedback gives our team something concrete to discuss as the programme develops.", "หลังการแสดง ผู้จัดการสถานที่ให้คะแนน 1–5 ดาวผ่าน LINE และเพิ่มความคิดเห็นได้ตามต้องการ ทีมของเรานำข้อมูลนี้มาคุยกันเพื่อปรับโปรแกรมให้เหมาะสม") },
  ] : [
    { title: c("Start with the occasion", "เริ่มจากภาพของงาน"), body: c("A company celebration, reception, launch or private party. Share the date, venue, audience and atmosphere, along with the moments where music needs to change gear.", "ไม่ว่าจะเป็นงานฉลองบริษัท งานเลี้ยงรับรอง งานเปิดตัว หรืองานส่วนตัว บอกวัน สถานที่ กลุ่มแขก และบรรยากาศที่ต้องการ รวมถึงช่วงที่อยากเปลี่ยนอารมณ์ของดนตรี") },
    { title: c("Find the right selectors", "เลือกดีเจที่เข้ากับงาน"), body: c("We propose suitable DJs from our roster, subject to availability. For a brief that calls for something more, ask about a live-musician pairing; the performers and setup are confirmed in the proposal.", "เราเสนอรายชื่อดีเจที่เหมาะสมตามคิวว่าง หากต้องการเพิ่มนักดนตรีสด สามารถปรึกษาเราได้ โดยจะยืนยันศิลปินและรูปแบบการแสดงในข้อเสนอ") },
    { title: c("Agree every moving part", "ตกลงรายละเอียดให้ชัดเจน"), body: c("Artist timings, equipment, soundcheck, travel and production responsibilities are agreed before confirmation. You receive a quotation for the scope we will deliver.", "เราตกลงเวลาแสดง อุปกรณ์ การซาวด์เช็ก การเดินทาง และผู้รับผิดชอบงานโปรดักชันก่อนยืนยัน พร้อมใบเสนอราคาที่ระบุขอบเขตงานอย่างชัดเจน") },
  ];
  const questions = venue ? [
    { q: c("Can we start with a few evenings?", "เริ่มจากบางคืนก่อนได้ไหม?"), a: c("Yes—tell us which evenings and hours you have in mind. A four-week paid programme can be scoped around those dates. Artist availability, equipment and fees are agreed in the quotation.", "ได้ บอกวันและเวลาที่ต้องการ เราสามารถวางขอบเขตโปรแกรมแบบมีค่าบริการ 4 สัปดาห์ตามวันที่ตกลง โดยยืนยันคิวดีเจ อุปกรณ์ และค่าบริการในใบเสนอราคา") },
    { q: c("Do we need to use another app?", "ต้องใช้แอปเพิ่มหรือไม่?"), a: c("Routine coordination and performance feedback can stay on LINE. The venue portal is there when you need to view or download your schedule.", "การประสานงานประจำและความคิดเห็นหลังการแสดงใช้ LINE ได้ ส่วนพอร์ทัลสถานที่มีไว้สำหรับดูหรือดาวน์โหลดตารางเมื่อคุณต้องการ") },
    { q: c("What about music between DJ sets?", "ช่วงที่ไม่มีดีเจใช้ดนตรีแบบไหน?"), a: c("Tell us about the whole day, not just the DJ hours. For business background music, we can discuss Beat Breeze by BMAsia Music as a separate service.", "เล่าให้เราฟังถึงทุกช่วงเวลาของวันได้ สำหรับดนตรีพื้นหลังในธุรกิจ เราสามารถคุยเรื่อง Beat Breeze โดย BMAsia Music ซึ่งเป็นบริการแยกต่างหาก") },
  ] : [
    { q: c("Can you work with our event planner?", "ทำงานร่วมกับอีเวนต์แพลนเนอร์ของเราได้ไหม?"), a: c("Yes. We agree the artist scope and coordinate timings and technical requirements with the nominated event or production contact. Your planner keeps the client relationship and overall production role unless otherwise agreed.", "ได้ เราตกลงขอบเขตของศิลปิน แล้วประสานเวลาและความต้องการด้านเทคนิคกับผู้ดูแลงานหรือทีมโปรดักชันที่คุณระบุ แพลนเนอร์ยังดูแลลูกค้าและภาพรวมโปรดักชัน เว้นแต่จะตกลงกันเป็นอย่างอื่น") },
    { q: c("Is sound equipment included?", "รวมเครื่องเสียงด้วยหรือไม่?"), a: c("Equipment is scoped for each event. Tell us what is already on site; we will agree what the DJ, venue and production team each provide before you confirm.", "อุปกรณ์ขึ้นอยู่กับขอบเขตแต่ละงาน แจ้งสิ่งที่สถานที่มีอยู่แล้ว เราจะตกลงว่าอุปกรณ์ส่วนใดมาจากดีเจ สถานที่ หรือทีมโปรดักชันก่อนยืนยันงาน") },
    { q: c("How is the booking confirmed?", "ยืนยันการจองอย่างไร?"), a: c("An enquiry starts the conversation. The booking is confirmed after the artists, date, scope, fee and payment terms have been agreed with our team.", "การสอบถามเป็นจุดเริ่มต้นของการพูดคุย การจองจะยืนยันหลังจากตกลงศิลปิน วัน ขอบเขตงาน ค่าบริการ และเงื่อนไขชำระเงินกับทีมแล้ว") },
  ];

  return <AgencyMotion><div className={styles.page} lang={th ? "th" : "en"}>
    <section className={`${styles.hero} ${venue ? "" : styles.eventHero}`} aria-labelledby="service-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>{venue ? c("FOR HOTELS, ROOFTOPS & RESTAURANTS", "สำหรับโรงแรม รูฟท็อป และร้านอาหาร") : c("FOR EVENTS & THE PEOPLE WHO PLAN THEM", "สำหรับงานอีเวนต์และทีมผู้จัดงาน")}</p>
        <h1 id="service-title">{title[0]}<br/><em>{title[1]}</em></h1>
        <p className={styles.intro}>{venue
          ? c("Resident and guest DJs. A musical direction that fits. One team to bring your programme together in Bangkok and Pattaya.", "ดีเจประจำและดีเจรับเชิญ แนวดนตรีที่เข้ากัน พร้อมทีมประสานโปรแกรมของคุณในกรุงเทพฯ และพัทยา")
          : c("DJs for company celebrations, receptions, launches and private events. Tell us what you have in mind. We’ll help shape the music around it.", "ดีเจสำหรับงานฉลองบริษัท งานเลี้ยงรับรอง งานเปิดตัว และงานส่วนตัว บอกภาพงานที่คุณต้องการ แล้วให้เราช่วยเลือกดนตรีที่เข้ากัน")}</p>
        <div className={styles.actions}><a className={agency.primary} href="#brief">{action}<span aria-hidden>↗</span></a><Link className={agency.textLink} href="/artists">{c("Meet the roster", "รู้จักดีเจของเรา")} <span aria-hidden>↗</span></Link></div>
        <p className={styles.location}>{c("BRIGHT EARS / BANGKOK & PATTAYA", "BRIGHT EARS / กรุงเทพฯ และพัทยา")}</p>
      </div>
      <figure className={styles.heroPhoto}>
        <Image src={venue ? "/agency/hero/dj-ufo.jpg" : "/agency/hero/dj-rabbitdisco.png"} alt={venue ? c("UFO performing at the decks", "UFO เล่นดนตรีที่บูธดีเจ") : "RabbitDisco"} fill sizes="(max-width: 800px) 88vw, 46vw" preload style={{objectPosition: venue ? "50% 48%" : "50% 35%"}}/>
        <span className={styles.photoStamp} aria-hidden="true">{venue ? "01 / RESIDENCIES" : "02 / OCCASIONS"}</span>
        <figcaption><span>{c("THE PEOPLE BEHIND THE MUSIC", "ผู้คนเบื้องหลังเสียงดนตรี")}</span><Link href={venue ? "/artists/dj-ufo" : "/artists/dj-rabbitdisco"}>{venue ? "UFO" : "RabbitDisco"} <span aria-hidden>↗</span></Link></figcaption>
      </figure>
    </section>

    <section className={styles.experience} aria-label={c("Our venue experience", "ประสบการณ์กับสถานที่")}> 
      <p>{c("GOOD COMPANY TO KEEP", "ผู้คนและสถานที่ที่เราได้ร่วมงาน")}</p>
      <div><Image src="/agency/clients/nobu.png" alt="Nobu" width={150} height={58}/><Image src="/agency/clients/ledukaan.svg" alt="Le Du Kaan" width={110} height={58}/><Image src="/agency/clients/hilton.png" alt="Hilton" width={90} height={58}/><Image src="/agency/clients/abar.png" alt="ABar" width={130} height={58}/></div>
    </section>

    <section className={styles.approach} aria-labelledby="approach-title">
      <div className={styles.sectionHeading} data-reveal><p className={styles.eyebrow}>{c("A FEEL FOR THE DETAILS", "ใส่ใจในรายละเอียด")}</p><h2 id="approach-title">{venue ? c("Good music.", "ดนตรีที่ดี") : c("From the first arrival", "ตั้งแต่แขกคนแรก")}<br/><em>{venue ? c("A considered programme.", "โปรแกรมที่ใส่ใจ") : c("to the final track.", "จนถึงเพลงสุดท้าย")}</em></h2><p>{venue ? c("The right DJ matters. So do the brief, the schedule and the conversation after the set.", "ดีเจที่เหมาะสมสำคัญ เช่นเดียวกับบรีฟ ตารางงาน และการพูดคุยหลังจบการแสดง") : c("A clear brief gives the music a place in the event. Here’s how we work it through with you.", "บรีฟที่ชัดเจนช่วยให้ดนตรีเป็นส่วนหนึ่งของงานอย่างลงตัว นี่คือวิธีที่เราทำงานร่วมกับคุณ")}</p></div>
      <ol className={styles.steps}>{steps.map((step, i) => <li key={step.title} data-reveal><span className={styles.stepNumber} aria-hidden="true">0{i + 1}</span><div><h3>{step.title}</h3><p>{step.body}</p></div></li>)}</ol>
    </section>

    {venue ? <section className={styles.pilot} aria-labelledby="pilot-title" data-reveal>
      <div className={styles.pilotNumber} aria-hidden="true">04<span>{c("WEEKS", "สัปดาห์")}</span></div>
      <div><p className={styles.eyebrow}>{c("A CLEAR PLACE TO START", "เริ่มต้นด้วยขอบเขตที่ชัดเจน")}</p><h2 id="pilot-title">{c("Four weeks.", "4 สัปดาห์")}<br/><em>{c("Let’s find your rhythm.", "ค้นหาจังหวะที่เข้ากับคุณ")}</em></h2><p>{c("Planning a new evening or refreshing part of your programme? Ask about a four-week paid series. We agree the dates, set lengths, artists, equipment responsibilities and fee before the first performance.", "กำลังวางแผนค่ำคืนใหม่หรือปรับโปรแกรมบางช่วงอยู่หรือไม่? ปรึกษาเราเรื่องโปรแกรมแบบมีค่าบริการ 4 สัปดาห์ โดยตกลงวัน ระยะเวลาของแต่ละเซ็ต ดีเจ ผู้รับผิดชอบอุปกรณ์ และค่าบริการก่อนเริ่มแสดง")}</p><a href="#brief" className={styles.pilotAction}>{c("Tell us about your room", "เล่าเรื่องสถานที่ของคุณ")} <span aria-hidden>↗</span></a><p className={styles.scopeNote}>{c("Dates and scope are subject to availability and an agreed quotation. Continuing beyond the series is a separate decision.", "วันและขอบเขตขึ้นอยู่กับคิวว่างและใบเสนอราคาที่ตกลงกัน การดำเนินโปรแกรมต่อหลังครบ 4 สัปดาห์จะพิจารณาร่วมกันอีกครั้ง")}</p></div>
    </section> : <section className={styles.planner} aria-labelledby="planner-title" data-reveal>
      <div><p className={styles.eyebrow}>{c("FOR PLANNERS & PRODUCTION TEAMS", "สำหรับแพลนเนอร์และทีมโปรดักชัน")}</p><h2 id="planner-title">{c("Your brief.", "บรีฟของคุณ")}<br/><em>{c("Our selectors.", "ดีเจของเรา")}</em></h2></div>
      <div><p>{c("Bring Bright Ears into your next brief as an entertainment supplier. Your team keeps its client relationship and agreed production responsibilities; we coordinate the artist scope we commit to.", "ให้ Bright Ears เป็นผู้จัดหาศิลปินสำหรับบรีฟถัดไปของคุณ ทีมคุณยังดูแลลูกค้าและรับผิดชอบโปรดักชันตามที่ตกลง ส่วนเราประสานงานศิลปินในขอบเขตที่รับผิดชอบ")}</p><p>{c("Start with one paid event. Artist fees, equipment, travel and any additional production are scoped in advance.", "เริ่มต้นจากงานแบบมีค่าบริการหนึ่งงาน โดยกำหนดค่าศิลปิน อุปกรณ์ การเดินทาง และโปรดักชันเพิ่มเติมให้ชัดเจนล่วงหน้า")}</p><a href="#brief" className={agency.textLink}>{c("Talk through your next brief", "คุยเรื่องบรีฟงานถัดไป")} <span aria-hidden>↗</span></a></div>
    </section>}

    <section className={styles.questions} aria-labelledby="questions-title"><div><p className={styles.eyebrow}>{c("BEFORE WE BEGIN", "ก่อนเริ่มงานด้วยกัน")}</p><h2 id="questions-title">{c("A few details.", "รายละเอียดที่ควรรู้")}</h2></div><div>{questions.map(({q, a}) => <details key={q}><summary>{q}<span aria-hidden="true">+</span></summary><p>{a}</p></details>)}</div></section>
    <aside className={styles.otherService}><p>{venue ? c("Planning one special occasion?", "กำลังจัดงานพิเศษหนึ่งครั้ง?") : c("Looking for music week after week?", "ต้องการดนตรีสำหรับทุกสัปดาห์?")}</p><Link href={venue ? "/events" : "/venues"}>{venue ? c("Explore event music", "ดูบริการดนตรีสำหรับอีเวนต์") : c("Explore venue programmes", "ดูโปรแกรมดนตรีสำหรับสถานที่")} <span aria-hidden>↗</span></Link></aside>
    <section id="brief" className={`${agency.briefSection} ${styles.brief}`}><AgencyBrief th={th} initialOccasion={occasion} source={kind}/></section>
  </div></AgencyMotion>;
}
