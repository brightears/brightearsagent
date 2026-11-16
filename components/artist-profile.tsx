import Image from "next/image";
import Link from "next/link";
import type { AgencyArtist } from "@/lib/agency/roster";
import { heroArtists } from "@/lib/agency/roster";
import { CITIES } from "@/lib/agency/application-contract";
import styles from "@/app/(marketing)/agency.module.css";

/** Shared by the public profile page and the private catalogue preview, so the artist checks exactly what goes live. */
export function ArtistProfile({ artist, related, th, preview }: { artist: AgencyArtist; related: AgencyArtist[]; th: boolean; preview?: "draft" | "published" }) {
  const c = (en: string, thai: string) => th ? thai : en;
  const id = artist.id;
  const catalogue = artist.source === "catalogue";
  const hero = heroArtists.find(a => a.id === id);
  const photo = hero?.image || artist.image;
  const city = artist.basedIn ? CITIES[artist.basedIn as keyof typeof CITIES] : undefined;
  const based = city ? (th ? city.th : city.en) : artist.city;
  const act = artist.actLabel ? (th ? artist.actLabel.th : artist.actLabel.en) : "DJ";
  const unoptimized = !!photo && (photo.startsWith("https:") || photo.startsWith("/api/"));
  // In a preview nothing links away to enquiry or kit pages; the artist only reads.
  const enquire = preview ? undefined : `/?artists=${encodeURIComponent(id)}#brief`;
  return <div className={styles.profilePage}>
    {preview
      ? <p className={styles.previewBanner} role="note">{preview === "draft"
          ? c("Preview: this profile is not public yet. Reply to us to publish it or to change anything.", "ตัวอย่าง: โปรไฟล์นี้ยังไม่เผยแพร่ ตอบกลับเราเพื่อยืนยันการเผยแพร่หรือแจ้งสิ่งที่ต้องการแก้ไข")
          : c("Preview: this profile is live on brightears.io.", "ตัวอย่าง: โปรไฟล์นี้เผยแพร่บน brightears.io แล้ว")}</p>
      : <Link href="/artists" className={styles.backLink}>← {c("All artists", "ศิลปินทั้งหมด")}</Link>}
    <section className={styles.profileHero}>
      <div className={styles.profileImage}>
        {photo ? <Image src={photo} alt={artist.name} fill sizes="(max-width: 750px) 88vw, 45vw" preload unoptimized={unoptimized} style={{ objectPosition: artist.id === "dj-yui-truluv" ? "50% 10%" : hero?.position || "50% 40%" }}/> : <span className={styles.artistPlaceholder}>{artist.name.slice(0, 2)}</span>}
        <span className={styles.profileStamp}>{catalogue ? "BRIGHT EARS / ARTIST" : "BRIGHT EARS / SELECTOR"}</span>
      </div>
      <div className={styles.profileCopy}>
        <p className={styles.kicker}>{based ? `${based} / ${act}` : act}</p>
        <h1>{artist.name}<span>↗</span></h1>
        {artist.played && <p className={styles.playedMark}>{c("Has played for Bright Ears", "เคยเล่นกับ Bright Ears")}</p>}
        <div className={styles.genreTags}>{artist.genres.map(g => <span key={g}>{g}</span>)}</div>
        <p className={styles.profileBio}>{(th ? artist.bioTh : artist.bio) || c("Get in touch for a personal introduction, music references and availability.", "ติดต่อเราเพื่อรู้จักศิลปิน ฟังตัวอย่างดนตรี และสอบถามวันว่าง")}</p>
        {artist.photoCredit && <p className={styles.photoCredit}>{c("Photo", "ภาพ")}: {artist.photoCredit}</p>}
        {enquire ? <Link href={enquire} className={styles.primary}>{c(`Book ${artist.name}`, `สอบถาม ${artist.name}`)} ↗</Link> : <span className={styles.primary} aria-disabled="true">{c(`Book ${artist.name}`, `สอบถาม ${artist.name}`)} ↗</span>}
        <p className={styles.profileNote}>{c("Tell us your date, venue and the night you have in mind. We’ll confirm availability and fees with you.", "แจ้งวัน สถานที่ และบรรยากาศที่ต้องการ เราจะยืนยันวันว่างและค่าบริการกับคุณ")}</p>
        {!catalogue && !preview && <Link href={`/artists/${encodeURIComponent(id)}/kit`} className={styles.textLink}>{c("Photos & promotion kit", "ภาพและสื่อประชาสัมพันธ์")} ↗</Link>}
        <div className={styles.artistLinks}>
          <p className={styles.kicker}>{c("EXPLORE THEIR WORLD", "รู้จักศิลปินให้มากขึ้น")}</p>
          {artist.links.length ? artist.links.map(l => <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer">{l.label} ↗</a>) : enquire && <Link href={enquire}>{c("Ask us for a mix or music reference", "ขอตัวอย่างมิกซ์หรือแนวดนตรี")} ↗</Link>}
        </div>
      </div>
    </section>
    {related.length > 0 && <section className={styles.relatedArtists}>
      <div className={styles.editorialHeading}><h2>{c("Keep", "ค้นหา")} <em>{c("listening.", "ต่อไป")}</em></h2><Link href="/artists" className={styles.textLink}>{c("All artists", "ศิลปินทั้งหมด")} ↗</Link></div>
      <div className={styles.relatedGrid}>{related.map(a => <Link href={"/artists/" + a.id} key={a.id}><div>{a.image && <Image src={a.image} alt={a.name} fill sizes="(max-width: 600px) 44vw, 22vw" unoptimized={a.image.startsWith("https:") || a.image.startsWith("/api/")} style={a.id === "dj-yui-truluv" ? { objectPosition: "50% 10%" } : undefined}/>}</div><h3>{a.name} ↗</h3><p>{a.genres.slice(0, 2).join(" / ")}</p></Link>)}</div>
    </section>}
  </div>;
}
