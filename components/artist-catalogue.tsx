"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import Image from "next/image";
import type {AgencyArtist} from "@/lib/agency/roster";
import {useAgencyShortlist} from "@/lib/agency/shortlist";
import {ACT_TAGS} from "@/lib/agency/catalogue-tags";
import {CITIES} from "@/lib/agency/application-contract";
import styles from "@/app/(marketing)/agency.module.css";
export function ArtistCatalogue({artists,th}:{artists:AgencyArtist[];th:boolean}){
 const [query,setQuery]=useState(""); const [genre,setGenre]=useState("all"); const [act,setAct]=useState("all"); const [based,setBased]=useState("all"); const [savedShortlist,setShortlist]=useAgencyShortlist();
 const shortlist=savedShortlist.filter(id=>artists.some(artist=>artist.id===id));
 const genres=useMemo(()=>[...new Set(artists.flatMap(a=>a.genres))].sort(),[artists]);
 // Act and "based in" filters appear only once the catalogue holds more than one value.
 const acts=(Object.keys(ACT_TAGS) as (keyof typeof ACT_TAGS)[]).filter(tag=>artists.some(a=>a.actTags?.includes(tag)));
 const places=[...new Set(artists.map(a=>a.basedIn).filter((v):v is string=>!!v))];
 const placeName=(key:string)=>{const city=CITIES[key as keyof typeof CITIES];return city?(th?city.th:city.en):key;};
 const visible=artists.filter(a=>(act==="all"||a.actTags?.includes(act))&&(based==="all"||a.basedIn===based)&&(genre==="all"||a.genres.includes(genre))&&[a.name,a.city,...a.genres,...(a.actLabel?[a.actLabel.en,a.actLabel.th]:[])].join(" ").toLowerCase().includes(query.toLowerCase()));
 const selected=artists.filter(a=>shortlist.includes(a.id));
 function toggle(id:string){setShortlist(items=>{const current=items.filter(item=>artists.some(artist=>artist.id===item));return current.includes(id)?current.filter(i=>i!==id):current.length<6?[...current,id]:current;});}
 return <>
  <div className={styles.catalogueTools}><label>{th?"ค้นหาศิลปิน":"Search the roster"}<input value={query} onChange={e=>setQuery(e.target.value)} placeholder={th?"ชื่อ แนวเพลง หรือเมือง":"Name, sound or city"} type="search"/></label><label>{th?"แนวเพลง":"Music style"}<select value={genre} onChange={e=>setGenre(e.target.value)}><option value="all">{th?"ทุกแนวเพลง":"All sounds"}</option>{genres.map(g=><option key={g}>{g}</option>)}</select></label>{acts.length>1&&<label>{th?"รูปแบบการแสดง":"Act"}<select value={act} onChange={e=>setAct(e.target.value)}><option value="all">{th?"ทุกรูปแบบ":"All acts"}</option>{acts.map(tag=><option key={tag} value={tag}>{th?ACT_TAGS[tag].th:ACT_TAGS[tag].en}</option>)}</select></label>}{places.length>1&&<label>{th?"ศิลปินอยู่ที่":"Based in"}<select value={based} onChange={e=>setBased(e.target.value)}><option value="all">{th?"ทุกที่":"Anywhere"}</option>{places.map(key=><option key={key} value={key}>{placeName(key)}</option>)}</select></label>}<p aria-live="polite">{visible.length} / {artists.length} {th?(acts.length>1?"ศิลปิน":"ดีเจ"):"artists"}</p></div>
  <div className={styles.catalogueGrid}>{visible.map((a,i)=><article className={styles.catalogueCard} key={a.id}><Link href={"/artists/"+encodeURIComponent(a.id)} className={styles.cataloguePhoto}>{a.image?<Image src={a.image} alt={a.name} fill sizes="(max-width: 600px) 44vw, (max-width: 1000px) 29vw, 22vw" preload={i<4} unoptimized={a.image.startsWith("https:")||a.image.startsWith("/api/")} style={a.id==="dj-yui-truluv"?{objectPosition:"50% 10%"}:undefined} />:<div className={styles.artistPlaceholder}>{a.name.slice(0,2).toUpperCase()}</div>}<span className={styles.photoIndex}>{String(artists.indexOf(a)+1).padStart(2,"0")} / BE</span><span className={styles.viewProfile}>{th?"ดูโปรไฟล์":"View artist"} ↗</span></Link><div className={styles.catalogueCaption}><Link href={"/artists/"+encodeURIComponent(a.id)}><h2>{a.name}</h2></Link><button type="button" aria-pressed={shortlist.includes(a.id)} aria-label={(shortlist.includes(a.id)?"Remove ":"Shortlist ")+a.name} onClick={()=>toggle(a.id)} disabled={shortlist.length>=6&&!shortlist.includes(a.id)}>{shortlist.includes(a.id)?"✓":"+"}</button></div><p className={styles.artistGenres}>{a.actLabel?(th?a.actLabel.th:a.actLabel.en)+" · ":""}{a.genres.slice(0,3).join(" / ")||a.city}{a.played&&<span className={styles.cardPlayed}>{th?"เคยเล่นกับ Bright Ears":"Has played for Bright Ears"}</span>}</p></article>)}</div>
  {visible.length===0&&<div className={styles.emptyRoster}><h2>{th?"ยังไม่พบศิลปินที่ตรงกับการค้นหา":"Let’s find another sound."}</h2><p>{th?"ลองเปลี่ยนคำค้นหาหรือแนวเพลง":"Try another name or music style."}</p><button onClick={()=>{setQuery("");setGenre("all");setAct("all");setBased("all");}}>{th?"ล้างตัวกรอง":"Clear filters"}</button></div>}
  {selected.length>0&&<aside className={styles.shortlistBar} aria-label={th?"รายชื่อดีเจที่เลือก":"Your shortlist"}><div><span>{th?"รายชื่อที่คุณเลือก":"Your lineup"} · {selected.length}/6</span><p>{selected.map(a=>a.name).join(" + ")}</p></div><Link href={"/?artists="+encodeURIComponent(selected.map(a=>a.id).join(","))+"#brief"}>{th?"สอบถามรายชื่อนี้":"Inquire about this lineup"} ↗</Link><button onClick={()=>setShortlist([])} aria-label={th?"ล้างรายชื่อ":"Clear shortlist"}>×</button></aside>}
 </>;
}
