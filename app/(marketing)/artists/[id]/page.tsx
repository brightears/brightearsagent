import Link from "next/link";
import {notFound} from "next/navigation";
import type {Metadata} from "next";
import {getPublicArtists} from "@/lib/agency/roster";
import {getRequestLocale} from "@/lib/i18n/server";
import {ArtistProfile} from "@/components/artist-profile";
import styles from "../../agency.module.css";
export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{const {id}=await params;const a=(await getPublicArtists()).find(a=>a.id===id);return {title:a?`${a.name} — Bright Ears` : "Artist — Bright Ears",description:a?.bio.slice(0,155)};}
export default async function ArtistPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const roster=await getPublicArtists();const artist=roster.find(a=>a.id===id);if(!artist){if(!roster.length)return <div className={styles.accountPage}><h1>Artist profiles are temporarily unavailable.</h1><Link href="/artists">Back to the roster ↗</Link></div>;notFound();}
 const th=(await getRequestLocale())==="th";
 const related=roster.filter(a=>a.id!==id&&a.genres.some(g=>artist.genres.includes(g))).slice(0,4);
 return <ArtistProfile artist={artist} related={related} th={th}/>;
}
