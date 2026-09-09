import type {Metadata} from "next";
import {getAgencyRoster} from "@/lib/agency/roster";
import {getRequestLocale} from "@/lib/i18n/server";
import {ArtistCatalogue} from "@/components/artist-catalogue";
import styles from "../agency.module.css";
export const metadata:Metadata={title:"The roster — Bright Ears DJs",description:"Explore Bright Ears DJs by name and music style. Discover artist profiles, listen to available mixes and build your shortlist."};
export default async function ArtistsPage(){
 const artists=await getAgencyRoster();const th=(await getRequestLocale())==="th";
 return <div className={styles.cataloguePage}><header className={styles.directoryIntro}><p className={styles.kicker}>{th?"ดีเจของ Bright Ears":"THE BRIGHT EARS ROSTER"} / BANGKOK & BEYOND</p><h1>{th?"คนที่ทำให้":"Good people."}<br/><em>{th?"ทุกคืนมีสีสัน.":"Great selectors."}</em></h1><div><p>{th?"ทุกคนมีเสียงที่เป็นเอกลักษณ์ สำรวจโปรไฟล์ เลือกแนวเพลง และจัดรายชื่อดีเจสำหรับงานของคุณ":"Different personalities. Different records. Find a sound that feels like you, explore the artist behind it, and build your lineup."}</p><span>{artists.length?String(artists.length).padStart(2,"0"):"—"}<small>{th?"ศิลปินในรายชื่อ":"artists in the roster"}</small></span></div></header>{artists.length?<ArtistCatalogue artists={artists} th={th}/>:<div className={styles.emptyRoster}><h2>{th?"กำลังโหลดรายชื่อดีเจ":"The roster is temporarily unavailable."}</h2><a href="mailto:info@brightears.io">{th?"ติดต่อเราเพื่อรับโปรไฟล์ดีเจ":"Contact us for artist profiles"} ↗</a></div>}</div>;
}
