"use client";
import { useRef, useState, type FormEvent } from "react";
import { EMPTY_BRIEF, briefEmailHref, formatMusicBrief, type MusicBrief } from "@/lib/agency/brief";
import styles from "@/app/(marketing)/agency.module.css";
export function AgencyBrief({th,initialArtist=""}:{th:boolean;initialArtist?:string}){
 const [brief,setBrief]=useState<MusicBrief>({...EMPTY_BRIEF,details:initialArtist ? (th ? "ดีเจที่สนใจ: " : "Preferred DJ: ") + initialArtist : ""}),[ready,setReady]=useState(false),[status,setStatus]=useState("");
 const result=useRef<HTMLTextAreaElement>(null);
 const c=(en:string,thai:string)=>th?thai:en;
 const change=(key:keyof MusicBrief,value:string)=>{setBrief(prev=>({...prev,[key]:value}));setReady(false);setStatus("");};
 function prepare(e:FormEvent<HTMLFormElement>){e.preventDefault();setReady(true);setStatus(c("Your brief is ready. Choose how to share it below.","บรีฟพร้อมแล้ว เลือกวิธีส่งด้านล่าง"));}
 async function copy(){try{await navigator.clipboard.writeText(formatMusicBrief(brief,th));setStatus(c("Copied. Paste your brief into LINE or an email.","คัดลอกแล้ว วางบรีฟใน LINE หรืออีเมลได้เลย"));}catch{result.current?.focus();result.current?.select();setStatus(c("Select and copy the brief below, then paste it into your message.","เลือกและคัดลอกบรีฟด้านล่าง แล้ววางในข้อความของคุณ"));}}
 const fields:{key:keyof MusicBrief;label:string;placeholder?:string;type?:string;required?:boolean;max:number}[]=[
 {key:"venue",label:c("Venue & city","สถานที่และเมือง"),placeholder:c("e.g. Rooftop bar, Bangkok","เช่น รูฟท็อปบาร์ กรุงเทพฯ"),required:true,max:100},
 {key:"date",label:c("Date / start date (optional)","วันที่ / วันเริ่มต้น (ไม่บังคับ)"),type:"date",max:10},
 {key:"time",label:c("Time & duration (optional)","เวลาและระยะเวลา (ไม่บังคับ)"),placeholder:c("e.g. Fridays, 7–11 pm","เช่น ทุกวันศุกร์ 19:00–23:00"),max:100},
 {key:"guests",label:c("Guests (optional)","จำนวนแขก (ไม่บังคับ)"),placeholder:c("Approximate number","จำนวนโดยประมาณ"),max:50}];
 return <div className={styles.briefGrid}><div className={styles.briefIntro}>
 <p className={styles.eyebrow}><span/>{c("Make a music brief","สร้างบรีฟดนตรี")}</p><h2>{c("Your night.","ค่ำคืนของคุณ")}<br/><em>{c("Your sound.","เสียงดนตรีที่ใช่")}</em></h2>
 <p>{c("A rooftop residency, a restaurant opening, a one-off celebration. Give us the essentials and we’ll take the conversation from there.","ไม่ว่าจะเป็นดีเจประจำรูฟท็อป เปิดร้านอาหาร หรืองานฉลอง บอกข้อมูลสำคัญให้เรา แล้วค่อยคุยรายละเอียดกันต่อ")}</p>
 <p className={styles.small}>{c("Prepare a brief here, then send it by email or copy it into LINE. Nothing is sent automatically.","เตรียมบรีฟที่นี่ แล้วส่งทางอีเมลหรือคัดลอกไปยัง LINE ระบบจะไม่ส่งข้อความอัตโนมัติ")}</p>
 <a className={styles.textLink} href="https://page.line.me/944grjuq">{c("Prefer a conversation? Find us on LINE","อยากคุยเลย? ติดต่อเราทาง LINE")} ↗</a></div>
 <form className={styles.briefForm} onSubmit={prepare}><div className={styles.formGrid}>
 <label>{c("What are you planning?","คุณกำลังวางแผนอะไร?")}<select required value={brief.occasion} onChange={e=>change("occasion",e.target.value)}><option value="">{c("Choose an occasion","เลือกรูปแบบงาน")}</option>{[c("A regular venue programme","โปรแกรมดนตรีประจำสถานที่"),c("A private celebration","งานฉลองส่วนตัว"),c("A brand or corporate event","งานแบรนด์หรือองค์กร"),c("A restaurant or venue opening","เปิดร้านอาหารหรือสถานที่"),c("Something else","รูปแบบอื่น")].map(v=><option key={v}>{v}</option>)}</select></label>
 {fields.map(f=><label key={f.key}>{f.label}<input required={f.required} type={f.type||"text"} maxLength={f.max} value={brief[f.key]} placeholder={f.placeholder} onChange={e=>change(f.key,e.target.value)}/></label>)}
 <label>{c("Sound & atmosphere","ดนตรีและบรรยากาศ")}<select required value={brief.sound} onChange={e=>change("sound",e.target.value)}><option value="">{c("Choose a direction","เลือกแนวทาง")}</option>{[c("Warm & relaxed","อบอุ่นและผ่อนคลาย"),c("Social & upbeat","สดใสและเป็นกันเอง"),c("Dancefloor energy","สนุกบนฟลอร์เต้นรำ"),c("Let’s find the right sound together","ช่วยเลือกแนวที่เหมาะให้เรา")].map(v=><option key={v}>{v}</option>)}</select></label>
 <label className={styles.fullWidth}>{c("Anything else we should know? (optional)","มีรายละเอียดอื่นเพิ่มเติมไหม? (ไม่บังคับ)")}<textarea rows={3} maxLength={500} value={brief.details} onChange={e=>change("details",e.target.value)} placeholder={c("Budget range, favourite artists, equipment on site, or anything to avoid.","งบประมาณ ศิลปินที่ชอบ อุปกรณ์ที่มี หรือสิ่งที่ต้องการหลีกเลี่ยง")}/></label>
 <label>{c("Your name","ชื่อของคุณ")}<input required autoComplete="name" maxLength={80} value={brief.name} onChange={e=>change("name",e.target.value)}/></label>
 <label>{c("Your email","อีเมลของคุณ")}<input required type="email" autoComplete="email" maxLength={150} value={brief.email} onChange={e=>change("email",e.target.value)}/></label></div>
 <button className={styles.primary} type="submit">{ready?c("Update my brief","อัปเดตบรีฟ"):c("Prepare my brief","เตรียมบรีฟของฉัน")}<span aria-hidden>↗</span></button>
 <p className={styles.formNote}>{c("This is an inquiry, not a confirmed booking. Dates, artists and fees are agreed with our team.","นี่เป็นการสอบถาม ยังไม่ใช่การยืนยันจอง กรุณาตกลงวัน ศิลปิน และค่าบริการกับทีมงาน")}</p>
 <p className={styles.copyStatus} role="status" aria-live="polite">{status}</p>
 {ready&&<div className={styles.briefResult}><label htmlFor="prepared-brief">{c("Your music brief","บรีฟดนตรีของคุณ")}</label><textarea id="prepared-brief" ref={result} readOnly rows={10} value={formatMusicBrief(brief,th)}/><div className={styles.resultActions}><a className={styles.primary} href={briefEmailHref(brief,th)}>{c("Open email draft","เปิดร่างอีเมล")} ↗</a><button className={styles.secondary} type="button" onClick={copy}>{c("Copy brief","คัดลอกบรีฟ")}</button><a className={styles.textLink} href="https://page.line.me/944grjuq">{c("Open LINE","เปิด LINE")} ↗</a></div><p className={styles.formNote}>{c("Email opens your mail app. If it doesn’t open, copy the brief and send it to info@brightears.io.","อีเมลจะเปิดแอปอีเมลของคุณ หากเปิดไม่ได้ ให้คัดลอกบรีฟแล้วส่งไปที่ info@brightears.io")}</p></div>}</form></div>;
}
