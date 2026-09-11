"use client";
import {useMemo,useState} from "react";
import Link from "next/link";
import Image from "next/image";
import type {AgencyArtist} from "@/lib/agency/roster";
import {useAgencyShortlist} from "@/lib/agency/shortlist";
import styles from "@/app/(marketing)/agency.module.css";
export function ArtistCatalogue({artists,th}:{artists:AgencyArtist[];th:boolean}){
 const [query,setQuery]=useState(""); const [genre,setGenre]=useState("all"); const [savedShortlist,setShortlist]=useAgencyShortlist();
 const shortlist=savedShortlist.filter(id=>artists.some(artist=>artist.id===id));
 const genres=useMemo(()=>[...new Set(artists.flatMap(a=>a.genres))].sort(),[artists]);
 const visible=artists.filter(a=>(genre==="all"||a.genres.includes(genre))&&[a.name,a.city,...a.genres].join(" ").toLowerCase().includes(query.toLowerCase()));
 const selected=artists.filter(a=>shortlist.includes(a.id));
 function toggle(id:string){setShortlist(items=>{const current=items.filter(item=>artists.some(artist=>artist.id===item));return current.includes(id)?current.filter(i=>i!==id):current.length<6?[...current,id]:current;});}
 return <>
  <div className={styles.catalogueTools}><label>{th?"ค้นหาดีเจ":"Search the roster"}<input value={query} onChange={e=>setQuery(e.target.value)} placeholder={th?"ชื่อ แนวเพลง หรือเมือง":"Name, sound or city"} type="search"/></label><label>{th?"แนวเพลง":"Music style"}<select value={genre} onChange={e=>setGenre(e.target.value)}><option value="all">{th?"ทุกแนวเพลง":"All sounds"}</option>{genres.map(g=><option key={g}>{g}</option>)}</select></label><p aria-live="polite">{visible.length} / {artists.length} {th?"ดีเจ":"artists"}</p></div>
  <div className={styles.catalogueGrid}>{visible.map((a,i)=><article className={styles.catalogueCard} key={a.id}><Link href={"/artists/"+encodeURIComponent(a.id)} className={styles.cataloguePhoto}>{a.image?<Image src={a.image} alt={a.name} fill sizes="(max-width: 600px) 44vw, (max-width: 1000px) 29vw, 22vw" preload={i<4} unoptimized={a.image.startsWith("https:")} />:<div className={styles.artistPlaceholder}>{a.name.slice(0,2).toUpperCase()}</div>}<span className={styles.photoIndex}>{String(artists.indexOf(a)+1).padStart(2,"0")} / BE</span><span className={styles.viewProfile}>{th?"ดูโปรไฟล์":"View artist"} ↗</span></Link><div className={styles.catalogueCaption}><Link href={"/artists/"+encodeURIComponent(a.id)}><h2>{a.name}</h2></Link><button type="button" aria-pressed={shortlist.includes(a.id)} aria-label={(shortlist.includes(a.id)?"Remove ":"Shortlist ")+a.name} onClick={()=>toggle(a.id)} disabled={shortlist.length>=6&&!shortlist.includes(a.id)}>{shortlist.includes(a.id)?"✓":"+"}</button></div><p className={styles.artistGenres}>{a.genres.slice(0,3).join(" / ")||a.city}</p></article>)}</div>
  {visible.length===0&&<div className={styles.emptyRoster}><h2>{th?"ยังไม่พบดีเจที่ตรงกับการค้นหา":"Let’s find another sound."}</h2><p>{th?"ลองเปลี่ยนคำค้นหาหรือแนวเพลง":"Try another name or music style."}</p><button onClick={()=>{setQuery("");setGenre("all");}}>{th?"ล้างตัวกรอง":"Clear filters"}</button></div>}
  {selected.length>0&&<aside className={styles.shortlistBar} aria-label={th?"รายชื่อดีเจที่เลือก":"Your shortlist"}><div><span>{th?"รายชื่อที่คุณเลือก":"Your lineup"} · {selected.length}/6</span><p>{selected.map(a=>a.name).join(" + ")}</p></div><Link href={"/?artists="+encodeURIComponent(selected.map(a=>a.id).join(","))+"#brief"}>{th?"สอบถามรายชื่อนี้":"Inquire about this lineup"} ↗</Link><button onClick={()=>setShortlist([])} aria-label={th?"ล้างรายชื่อ":"Clear shortlist"}>×</button></aside>}
 </>;
}
