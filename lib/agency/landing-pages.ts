import type { LandingConfig } from "@/components/agency-landing-page";

// Buyer search pages. Evidence lists only current programmes confirmed in
// Vinyl's 10 November 2026 snapshot (team/shared/requests/BE-GROWTH-SNAPSHOT-20261110-01)
// and venue names the site already shows. No rates, contract terms or feedback.

const venueOccasion = { en: "A regular venue programme", th: "โปรแกรมดนตรีประจำสถานที่" };
const coverQuestion = {
  q: { en: "What happens if a DJ is ill?", th: "ถ้าดีเจป่วยกะทันหันจะทำอย่างไร?" },
  a: { en: "We find a replacement from the roster and confirm the change with your team. How cover works is agreed before the programme starts.", th: "เราหาดีเจแทนจากรายชื่อศิลปินของเรา และแจ้งยืนยันกับทีมของคุณ โดยตกลงแนวทางจัดหาดีเจแทนไว้ก่อนเริ่มโปรแกรม" },
};
const startQuestion = {
  q: { en: "Can we start with a few evenings?", th: "เริ่มจากบางคืนก่อนได้ไหม?" },
  a: { en: "Yes. Tell us which evenings and hours you have in mind. We can scope a four-week paid series around those dates, with artists, equipment and fees agreed in the quotation.", th: "ได้ แจ้งวันและเวลาที่ต้องการได้เลย เราจะวางโปรแกรมแบบมีค่าบริการระยะ 4 สัปดาห์ตามวันดังกล่าว โดยระบุศิลปิน อุปกรณ์ และค่าบริการไว้ในใบเสนอราคา" },
};
const lineQuestion = {
  q: { en: "Do we need another app?", th: "ต้องใช้แอปเพิ่มหรือไม่?" },
  a: { en: "No. Routine coordination and after-set ratings stay on LINE. The venue portal is there when you want to view or download the schedule.", th: "ไม่ต้อง การประสานงานประจำวันและการให้คะแนนหลังการแสดงยังคงใช้ LINE ตามเดิม ส่วนพอร์ทัลสถานที่มีไว้สำหรับดูหรือดาวน์โหลดตารางเมื่อต้องการ" },
};
const venueSteps = [
  { title: { en: "A music direction for each part of the night", th: "แนวดนตรีสำหรับแต่ละช่วงของค่ำคืน" }, body: { en: "Tell us who your guests are and which hours you want to fill. We agree a brief with your team, from early dinner to the last hour at the bar.", th: "แจ้งเราว่าแขกของคุณเป็นใคร และต้องการดนตรีช่วงเวลาใด เราจะวางบรีฟร่วมกับทีมของคุณ ตั้งแต่มื้อค่ำช่วงหัวค่ำจนถึงชั่วโมงสุดท้ายที่บาร์" } },
  { title: { en: "A schedule we run", th: "ตารางงานที่เราดูแลให้" }, body: { en: "We book the DJs, publish the schedule in the venue portal and arrange cover when someone cannot play.", th: "เราจองดีเจ ลงตารางในพอร์ทัลสถานที่ และจัดหาดีเจแทนเมื่อมีคนเล่นไม่ได้" } },
  { title: { en: "Ratings after every set", th: "ให้คะแนนหลังทุกเซ็ต" }, body: { en: "Your managers can rate each performance from 1 to 5 stars in LINE and add a comment. We review those ratings with your team as the programme develops.", th: "ผู้จัดการของคุณให้คะแนนการแสดงแต่ละครั้งได้ 1–5 ดาวผ่าน LINE พร้อมเพิ่มความคิดเห็น เราจะนำคะแนนเหล่านี้มาทบทวนร่วมกับทีมของคุณเพื่อพัฒนาโปรแกรมต่อไป" } },
];

export const BANGKOK: LandingConfig = {
  eyebrow: { en: "BANGKOK · HOTELS, ROOFTOPS & RESTAURANTS", th: "กรุงเทพฯ · โรงแรม รูฟท็อป และร้านอาหาร" },
  title: [{ en: "DJs for Bangkok", th: "ดีเจสำหรับ" }, { en: "hotels and rooftops.", th: "โรงแรมและรูฟท็อปในกรุงเทพฯ" }],
  intro: { en: "We book resident and guest DJs for hotel bars, rooftops and restaurants across Bangkok. We plan the music with your team, run the schedule and arrange cover when a DJ cannot play.", th: "เราจัดหาดีเจประจำและดีเจรับเชิญให้บาร์ในโรงแรม รูฟท็อป และร้านอาหารทั่วกรุงเทพฯ วางแนวดนตรีร่วมกับทีมของคุณ ดูแลตารางงาน และหาดีเจแทนเมื่อมีคนเล่นไม่ได้" },
  action: { en: "Plan your Bangkok programme", th: "วางแผนโปรแกรมดนตรีในกรุงเทพฯ" },
  heroArtistId: "dj-scotty-b", stamp: "BKK / RESIDENCIES",
  evidence: {
    heading: { en: "WHERE WE PLAY NOW", th: "สถานที่ที่เราดูแลอยู่ตอนนี้" },
    note: { en: "Bangkok venues with a Bright Ears DJ programme every night of the week, November 2026.", th: "สถานที่ในกรุงเทพฯ ที่มีโปรแกรมดีเจของ Bright Ears ทุกคืน (ข้อมูล ณ เดือนพฤศจิกายน 2569)" },
    items: [
      { name: "Nobu Bangkok", place: { en: "Restaurant and bar", th: "ร้านอาหารและบาร์" }, logo: { src: "/agency/clients/nobu.png", width: 120 } },
      { name: "Le Du Kaan", place: { en: "Restaurant, early and late sets", th: "ร้านอาหาร เซ็ตหัวค่ำและเซ็ตดึก" }, logo: { src: "/agency/clients/ledukaan.svg", width: 100 } },
      { name: "ABar Rooftop", place: { en: "Bangkok Marriott Marquis Queen’s Park", th: "Bangkok Marriott Marquis Queen’s Park" }, logo: { src: "/agency/clients/abar.png", width: 110, invert: true } },
    ],
  },
  formats: {
    heading: { en: "Formats we run in Bangkok", th: "รูปแบบที่เราจัดในกรุงเทพฯ" },
    items: [
      { en: "One DJ for a four-hour evening", th: "ดีเจหนึ่งคนสำหรับค่ำคืน 4 ชั่วโมง" },
      { en: "Two DJs splitting the night into an early and a late set", th: "ดีเจสองคนแบ่งเป็นเซ็ตหัวค่ำและเซ็ตดึก" },
      { en: "Saxophone and percussion for a Sunday brunch", th: "แซกโซโฟนและเพอร์คัชชันสำหรับบรันช์วันอาทิตย์" },
    ],
  },
  stepsHeading: [{ en: "HOW A PROGRAMME RUNS", th: "ขั้นตอนการดูแลโปรแกรมดนตรี" }, { en: "Your nights,", th: "ทุกค่ำคืนของคุณ" }, { en: "one team to run them.", th: "ดูแลโดยทีมเดียว" }],
  steps: venueSteps,
  questions: [startQuestion, coverQuestion, lineQuestion],
  other: [
    { text: { en: "Running a venue in Pattaya?", th: "ดูแลสถานที่ในพัทยาอยู่หรือไม่?" }, href: "/venues/pattaya", link: { en: "DJs for Pattaya", th: "ดีเจสำหรับพัทยา" } },
    { text: { en: "Planning 31 December?", th: "กำลังวางแผนคืนวันที่ 31 ธันวาคม?" }, href: "/events/new-years-eve", link: { en: "New Year’s Eve entertainment", th: "ความบันเทิงคืนส่งท้ายปีเก่า" } },
  ],
  brief: { occasion: venueOccasion, source: "bangkok" },
};

export const PATTAYA: LandingConfig = {
  eyebrow: { en: "PATTAYA · HOTELS, ROOFTOPS & BEACH VENUES", th: "พัทยา · โรงแรม รูฟท็อป และสถานที่ริมทะเล" },
  title: [{ en: "DJs for Pattaya", th: "ดีเจสำหรับ" }, { en: "hotels and rooftops.", th: "โรงแรมและรูฟท็อปในพัทยา" }],
  intro: { en: "We run the nightly house-music programme at Horizon, the rooftop bar at Hilton Pattaya. Other hotels, rooftops and beach venues in Pattaya can book the same service: an agreed music direction, a schedule we run and a team you can reach on LINE.", th: "เราดูแลโปรแกรมดนตรีเฮาส์ทุกคืนที่ Horizon รูฟท็อปบาร์ของ Hilton Pattaya โรงแรม รูฟท็อป และสถานที่ริมทะเลอื่น ๆ ในพัทยาก็สามารถใช้บริการแบบเดียวกันได้ ทั้งแนวดนตรีที่ตกลงร่วมกัน ตารางงานที่เราดูแลให้ และทีมงานที่ติดต่อได้ทาง LINE" },
  action: { en: "Plan your Pattaya programme", th: "วางแผนโปรแกรมดนตรีในพัทยา" },
  heroArtistId: "dj-benji", stamp: "PTY / SUNSET TO LATE",
  evidence: {
    heading: { en: "WHERE WE PLAY NOW", th: "สถานที่ที่เราดูแลอยู่ตอนนี้" },
    note: { en: "A Bright Ears DJ plays Horizon every night from sunset, November 2026.", th: "ดีเจของ Bright Ears เล่นที่ Horizon ทุกคืนตั้งแต่ช่วงพระอาทิตย์ตก (ข้อมูล ณ เดือนพฤศจิกายน 2569)" },
    items: [
      { name: "Horizon Rooftop", place: { en: "Hilton Pattaya · house music, one DJ nightly", th: "Hilton Pattaya · ดนตรีเฮาส์ ดีเจหนึ่งคนทุกคืน" }, logo: { src: "/agency/clients/hilton.png", width: 80, invert: true } },
    ],
  },
  formats: {
    heading: { en: "What we can scope in Pattaya", th: "สิ่งที่เราวางขอบเขตให้ได้ในพัทยา" },
    items: [
      { en: "A nightly sunset-to-evening DJ set", th: "เซ็ตดีเจทุกคืน ตั้งแต่ช่วงพระอาทิตย์ตกถึงหัวค่ำ" },
      { en: "Weekend pool or beach sessions", th: "เซ็ตริมสระหรือริมทะเลช่วงสุดสัปดาห์" },
      { en: "Event nights with a DJ and a live musician", th: "คืนพิเศษกับดีเจและนักดนตรีสด" },
    ],
  },
  stepsHeading: [{ en: "HOW A PROGRAMME RUNS", th: "ขั้นตอนการดูแลโปรแกรมดนตรี" }, { en: "Sunset to late,", th: "ตั้งแต่พระอาทิตย์ตกถึงดึก" }, { en: "one team to run it.", th: "ดูแลโดยทีมเดียว" }],
  steps: venueSteps,
  questions: [
    { q: { en: "Do the DJs travel from Bangkok?", th: "ดีเจเดินทางมาจากกรุงเทพฯ หรือไม่?" }, a: { en: "Tell us the dates and hours. The quotation names the artists who will play in Pattaya and includes any travel costs.", th: "บอกวันและเวลาที่ต้องการ ใบเสนอราคาจะระบุชื่อศิลปินที่จะเล่นในพัทยา และรวมค่าเดินทาง (ถ้ามี)" } },
    startQuestion, coverQuestion,
  ],
  other: [
    { text: { en: "Running a venue in Bangkok?", th: "ดูแลสถานที่ในกรุงเทพฯ อยู่หรือไม่?" }, href: "/venues/bangkok", link: { en: "DJs for Bangkok", th: "ดีเจสำหรับกรุงเทพฯ" } },
    { text: { en: "Planning 31 December?", th: "กำลังวางแผนคืนวันที่ 31 ธันวาคม?" }, href: "/events/new-years-eve", link: { en: "New Year’s Eve entertainment", th: "ความบันเทิงคืนส่งท้ายปีเก่า" } },
  ],
  brief: { occasion: venueOccasion, source: "pattaya" },
};

export const NEW_YEARS_EVE: LandingConfig = {
  eyebrow: { en: "31 DECEMBER · BANGKOK & PATTAYA", th: "31 ธันวาคม · กรุงเทพฯ และพัทยา" },
  title: [{ en: "New Year’s Eve,", th: "คืนส่งท้ายปีเก่า" }, { en: "planned before December.", th: "วางแผนให้พร้อมก่อนเดือนธันวาคม" }],
  intro: { en: "DJs, live musicians and MCs for hotel countdown parties, rooftop nights and private celebrations on 31 December. Send us the venue, the hours and the guest count, and we will confirm artist availability in a written quotation.", th: "ดีเจ นักดนตรีสด และพิธีกร สำหรับงานเคาต์ดาวน์ในโรงแรม ปาร์ตี้บนรูฟท็อป และงานฉลองส่วนตัวในคืนวันที่ 31 ธันวาคม แจ้งสถานที่ ช่วงเวลา และจำนวนแขกมาให้เรา แล้วเราจะยืนยันคิวศิลปินในใบเสนอราคาเป็นลายลักษณ์อักษร" },
  action: { en: "Ask about 31 December", th: "สอบถามสำหรับคืนวันที่ 31 ธันวาคม" },
  heroArtistId: "dj-hvngyvk", stamp: "31.12 / COUNTDOWN",
  formats: {
    heading: { en: "Line-ups we can put together", th: "รูปแบบไลน์อัปที่เราจัดได้" },
    items: [
      { en: "A DJ from dinner through the countdown", th: "ดีเจตั้งแต่มื้อค่ำจนถึงช่วงนับถอยหลัง" },
      { en: "A live act for dinner, then a DJ after midnight", th: "การแสดงดนตรีสดช่วงมื้อค่ำ แล้วต่อด้วยดีเจหลังเที่ยงคืน" },
      { en: "An MC to host the countdown in Thai and English", th: "พิธีกรดำเนินการนับถอยหลังทั้งภาษาไทยและอังกฤษ" },
    ],
  },
  stepsHeading: [{ en: "HOW WE PLAN IT", th: "เราวางแผนอย่างไร" }, { en: "Dinner, countdown,", th: "มื้อค่ำ นับถอยหลัง" }, { en: "after midnight.", th: "และหลังเที่ยงคืน" }],
  steps: [
    { title: { en: "Plan the night in parts", th: "แบ่งค่ำคืนเป็นช่วง" }, body: { en: "Arrival and dinner, the run-up to midnight and the hours after it each need different music. Tell us the timings and we propose who plays when.", th: "ช่วงแขกมาถึงและมื้อค่ำ ช่วงก่อนเที่ยงคืน และช่วงหลังจากนั้นต้องการดนตรีต่างกัน บอกเวลาของแต่ละช่วง แล้วเราจะเสนอว่าใครเล่นช่วงไหน" } },
    { title: { en: "Agree who runs the countdown", th: "ตกลงว่าใครดำเนินการนับถอยหลัง" }, body: { en: "The DJ can call it, or an MC can host it while the DJ keeps the music going. We agree the script, the clock and any fireworks cue with your events team.", th: "ดีเจนับถอยหลังเองได้ หรือให้พิธีกรดำเนินรายการขณะที่ดีเจเล่นดนตรีต่อ เราตกลงบท เวลา และคิวพลุ (ถ้ามี) กับทีมจัดงานของคุณ" } },
    { title: { en: "Confirm in writing", th: "ยืนยันเป็นลายลักษณ์อักษร" }, body: { en: "Artists, set times, equipment, soundcheck and fees go into the quotation. The booking is confirmed once you accept it and the payment terms are agreed.", th: "ศิลปิน เวลาแสดง อุปกรณ์ การซาวด์เช็ก และค่าบริการระบุไว้ในใบเสนอราคา การจองจะยืนยันเมื่อคุณตอบรับและตกลงเงื่อนไขการชำระเงินแล้ว" } },
  ],
  questions: [
    { q: { en: "Is sound equipment included?", th: "รวมเครื่องเสียงด้วยหรือไม่?" }, a: { en: "It depends on the venue. Tell us what is already on site, and the quotation will say what the artists, the venue and any production team each provide.", th: "ขึ้นอยู่กับสถานที่ แจ้งอุปกรณ์ที่มีอยู่แล้ว ใบเสนอราคาจะระบุว่าอุปกรณ์ส่วนใดมาจากศิลปิน สถานที่ หรือทีมโปรดักชัน" } },
    { q: { en: "Can you work with our event planner?", th: "ทำงานร่วมกับอีเวนต์แพลนเนอร์ของเราได้ไหม?" }, a: { en: "Yes. We coordinate timings and technical needs with the contact you name. Your planner keeps the client relationship and the overall production.", th: "ได้ เราประสานเวลาและความต้องการด้านเทคนิคกับผู้ติดต่อที่คุณระบุ แพลนเนอร์ยังดูแลลูกค้าและภาพรวมโปรดักชันตามเดิม" } },
    { q: { en: "How is the booking confirmed?", th: "ยืนยันการจองอย่างไร?" }, a: { en: "An enquiry starts the conversation. The booking is confirmed after the artists, date, scope, fee and payment terms have been agreed with our team.", th: "การสอบถามเป็นจุดเริ่มต้นของการพูดคุย การจองจะยืนยันหลังจากตกลงศิลปิน วัน ขอบเขตงาน ค่าบริการ และเงื่อนไขชำระเงินกับทีมแล้ว" } },
  ],
  other: [
    { text: { en: "Want a live musician as well?", th: "ต้องการนักดนตรีสดเพิ่มเติมหรือไม่?" }, href: "/acts", link: { en: "See the act formats", th: "ดูรูปแบบการแสดง" } },
    { text: { en: "Planning another kind of event?", th: "กำลังวางแผนงานรูปแบบอื่นอยู่หรือไม่?" }, href: "/events", link: { en: "Event music", th: "ดนตรีสำหรับอีเวนต์" } },
  ],
  brief: { occasion: { en: "New Year’s Eve", th: "งานคืนส่งท้ายปีเก่า" }, source: "new-years-eve", date: "2026-12-31" },
};

export const ACTS: LandingConfig = {
  eyebrow: { en: "DJS, LIVE MUSICIANS, SINGERS & MCS", th: "ดีเจ นักดนตรีสด นักร้อง และพิธีกร" },
  title: [{ en: "DJs and live acts,", th: "ดีเจและดนตรีสด" }, { en: "booked by one team.", th: "จองผ่านทีมเดียว" }],
  intro: { en: "Alongside our DJs, we book live musicians, singers and MCs for hotel brunches, sunset sessions, dinners and events in Bangkok and Pattaya. Tell us the setting and we propose a format. The quotation names the performers.", th: "นอกจากดีเจ เรายังจัดหานักดนตรีสด นักร้อง และพิธีกร สำหรับบรันช์ในโรงแรม ช่วงพระอาทิตย์ตก มื้อค่ำ และงานอีเวนต์ในกรุงเทพฯ และพัทยา บอกเราว่างานเป็นแบบไหน แล้วเราจะเสนอรูปแบบที่เหมาะ ใบเสนอราคาจะระบุชื่อผู้แสดง" },
  action: { en: "Ask about a live act", th: "สอบถามเรื่องดนตรีสด" },
  heroPanel: [
    { en: "DJ + saxophone", th: "ดีเจ + แซกโซโฟน" },
    { en: "DJ + percussion", th: "ดีเจ + เพอร์คัชชัน" },
    { en: "Solo violin or piano", th: "ไวโอลินหรือเปียโนเดี่ยว" },
    { en: "Vocal duo", th: "นักร้องคู่" },
    { en: "Jazz trio", th: "วงแจ๊ส 3 ชิ้น" },
    { en: "MC / host", th: "พิธีกร / MC" },
  ],
  evidence: {
    heading: { en: "LIVE MUSIC WE HAVE DELIVERED", th: "ดนตรีสดที่เราเคยจัด" },
    note: { en: "Our live roster is smaller than our DJ roster. Each performer is confirmed by name before you agree a quotation.", th: "รายชื่อศิลปินดนตรีสดของเรายังมีน้อยกว่าดีเจ เรายืนยันชื่อผู้แสดงทุกคนก่อนคุณตกลงใบเสนอราคา" },
    items: [
      { name: "Nobu Bangkok", place: { en: "Saxophone and percussion for the first-Sunday brunch, March to July 2026", th: "แซกโซโฟนและเพอร์คัชชันสำหรับบรันช์วันอาทิตย์แรกของเดือน มีนาคม–กรกฎาคม 2569" }, logo: { src: "/agency/clients/nobu.png", width: 120 } },
    ],
  },
  stepsHeading: [{ en: "HOW WE BOOK A LIVE ACT", th: "เราจองดนตรีสดอย่างไร" }, { en: "Sound, space", th: "เสียง พื้นที่" }, { en: "and timing first.", th: "และเวลาต้องมาก่อน" }],
  steps: [
    { title: { en: "Start with the setting", th: "เริ่มจากสถานที่และช่วงเวลา" }, body: { en: "A Sunday brunch, a lobby at six o’clock and a gala dinner need different acts. Tell us the room, the hours and how loud the music can be.", th: "บรันช์วันอาทิตย์ ล็อบบี้ตอนหกโมงเย็น และงานกาลาดินเนอร์ต้องการการแสดงต่างกัน บอกเราเรื่องพื้นที่ ช่วงเวลา และระดับเสียงที่ทำได้" } },
    { title: { en: "Check what the room can take", th: "ตรวจสอบสิ่งที่พื้นที่รองรับได้" }, body: { en: "Live acts need space, power, monitors and microphones. We confirm these with the performers and your team before the date.", th: "ดนตรีสดต้องการพื้นที่ ไฟฟ้า มอนิเตอร์ และไมโครโฟน เรายืนยันเรื่องเหล่านี้กับผู้แสดงและทีมของคุณก่อนถึงวันงาน" } },
    { title: { en: "One quotation, one contact", th: "ใบเสนอราคาเดียว ผู้ติดต่อคนเดียว" }, body: { en: "DJs and live acts come in the same quotation and the same schedule, so your team deals with one agency.", th: "ดีเจและดนตรีสดอยู่ในใบเสนอราคาและตารางงานเดียวกัน ทีมของคุณจึงติดต่อกับเอเจนซีเดียว" } },
  ],
  questions: [
    { q: { en: "Can a live act use our sound system?", th: "ดนตรีสดใช้เครื่องเสียงของสถานที่ได้ไหม?" }, a: { en: "Often, yes. Tell us what the venue has. We check power, monitors and microphones with the performers before we confirm.", th: "ส่วนใหญ่ใช้ได้ แจ้งอุปกรณ์ที่สถานที่มี เราจะตรวจสอบไฟฟ้า มอนิเตอร์ และไมโครโฟนกับผู้แสดงก่อนยืนยัน" } },
    { q: { en: "Can we add a musician to an existing DJ night?", th: "เพิ่มนักดนตรีในคืนที่มีดีเจอยู่แล้วได้ไหม?" }, a: { en: "Yes. A saxophonist or percussionist can play over the DJ for part of the evening. We agree the hours and the volume with your team.", th: "ได้ นักแซกโซโฟนหรือนักเพอร์คัชชันเล่นร่วมกับดีเจในบางช่วงของค่ำคืนได้ เราตกลงช่วงเวลาและระดับเสียงกับทีมของคุณ" } },
    { q: { en: "How is the booking confirmed?", th: "ยืนยันการจองอย่างไร?" }, a: { en: "An enquiry starts the conversation. The booking is confirmed after the performers, date, scope, fee and payment terms have been agreed with our team.", th: "การสอบถามเป็นจุดเริ่มต้นของการพูดคุย การจองจะยืนยันหลังจากตกลงผู้แสดง วัน ขอบเขตงาน ค่าบริการ และเงื่อนไขชำระเงินกับทีมแล้ว" } },
  ],
  other: [
    { text: { en: "Looking for music week after week?", th: "ต้องการดนตรีประจำทุกสัปดาห์หรือไม่?" }, href: "/venues", link: { en: "Venue programmes", th: "โปรแกรมดนตรีสำหรับสถานที่" } },
    { text: { en: "Planning 31 December?", th: "กำลังวางแผนคืนวันที่ 31 ธันวาคม?" }, href: "/events/new-years-eve", link: { en: "New Year’s Eve entertainment", th: "ความบันเทิงคืนส่งท้ายปีเก่า" } },
  ],
  brief: { occasion: { en: "A brand or corporate event", th: "งานแบรนด์หรือองค์กร" }, source: "acts", actType: "DJ with a live musician" },
};

export const LANDING_PAGES = { BANGKOK, PATTAYA, NEW_YEARS_EVE, ACTS };
