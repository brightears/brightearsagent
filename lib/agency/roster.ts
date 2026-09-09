import { cache } from "react";
import { createHash } from "node:crypto";
import curated from "./roster-assets.json";
export const heroArtists = curated.heroes;

export type AgencyArtist = {
  id: string; name: string; bio: string; bioTh: string; city: string; genres: string[];
  image: string | null; gallery: string[];
  links: {label: string; url: string}[];
};
const ORIGIN = "https://agency.brightears.io";
function publicImage(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  if (value.startsWith("/images/djs/")) return ORIGIN + value;
  try { const url=new URL(value); return url.protocol==="https:" && ["res.cloudinary.com","images.unsplash.com", "agency.brightears.io"].includes(url.hostname) ? url.href : null; } catch { return null; }
}
function publicLink(value: unknown, domain: string): string | null {
  if(typeof value!=="string" || !value.trim()) return null;
  let input=value.trim();
  const allowed=(host:string)=>host===domain||host.endsWith("."+domain)||(domain==="youtube.com"&&host==="youtu.be");
  if(input.startsWith("//")) input="https:"+input;
  if(!/^https?:\/\//i.test(input)) {
    try {const candidate=new URL("https://"+input);input=allowed(candidate.hostname)?candidate.href:"https://"+domain+"/"+input.replace(/^@/,"");} catch{return null;}
  }
  try {const url=new URL(input); if(url.protocol!=="https:"||url.username||url.password||!allowed(url.hostname))return null; return url.href;} catch{return null;}
}
export function sanitizeArtist(value: Record<string,unknown>): AgencyArtist | null {
  if(!value || typeof value!=="object" || typeof value.id!=="string" || typeof value.stageName!=="string") return null;
  const genres=Array.isArray(value.genres)?[...new Set(value.genres.filter((v):v is string=>typeof v==="string").map(v=>{const key=v.toLowerCase().replace(/[\s-]/g,"");return key==="hiphop"?"Hip-Hop":key==="kpop"?"K-Pop":v.trim();}).filter(Boolean))].slice(0,12):[];
  const rawBio=typeof value.bio==="string"?value.bio:"";
  const internal=/schedule|rotation|not available|unavailable|replacement|per shift|off every|replaces|every (monday|tuesday|wednesday|thursday|friday|saturday|sunday)|THB|฿/i.test(rawBio);
  const note=(curated.bios as Record<string,{hash:string;en:string;th:string}>)[value.id];
  const unchanged=note?.hash===createHash("sha256").update(rawBio).digest("hex");
  const bio=unchanged?note.en:internal?"":rawBio;
  const photo=(curated.photos as Record<string,{source:string;local:string}>)[value.id];
  const image=photo && photo.source===value.profileImage?photo.local:publicImage(value.profileImage);
  const links=[["instagram","Instagram","instagram.com"],["soundcloud","SoundCloud","soundcloud.com"],["mixcloud","Mixcloud","mixcloud.com"],["spotify","Spotify","open.spotify.com"],["youtube","YouTube","youtube.com"]].flatMap(([field,label,domain])=>{
    const url=publicLink(value[field],domain); return url?[{label,url}]:[];
  });
  return {id:value.id,name:value.stageName,bio,bioTh:unchanged?note.th:internal?"":typeof value.bioTh==="string"?value.bioTh:"",city:typeof value.baseCity==="string"?value.baseCity:"Bangkok",genres,image,gallery:[...new Set([image,...(Array.isArray(value.images)?value.images.map(publicImage):[])].filter((p):p is string=>!!p))],links};
}
export const getAgencyRoster=cache(async ():Promise<AgencyArtist[]>=>{
  try {
    const response=await fetch(ORIGIN+"/api/artists?categories=DJ&limit=100",{next:{revalidate:300},signal:AbortSignal.timeout(12000)});
    if(!response.ok) throw new Error("Roster unavailable");
    const data=await response.json();
    if(!Array.isArray(data.artists)) return [];
    return data.artists.map(sanitizeArtist).filter((a:AgencyArtist|null):a is AgencyArtist=>a!==null).sort((a:AgencyArtist,b:AgencyArtist)=>a.name.localeCompare(b.name));
  } catch {return [];}
});
