"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import type { AgencyArtist } from "@/lib/agency/roster";
import { localKitDownload } from "@/lib/agency/promotion-kit";
import styles from "./agency-promotion-kit.module.css";

export { localKitDownload } from "@/lib/agency/promotion-kit";

export function AgencyPromotionKit({ artist, th }: { artist: AgencyArtist; th: boolean }) {
  const c = (en: string, thai: string) => th ? thai : en;
  const bio = th ? artist.bioTh || artist.bio : artist.bio || artist.bioTh;
  const bioLanguage = th ? artist.bioTh ? "th" : "en" : artist.bio ? "en" : "th";
  const biography = useRef<HTMLTextAreaElement>(null);
  const [status, setStatus] = useState("");
  const [imageSize, setImageSize] = useState<{width: number; height: number} | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const [zipState, setZipState] = useState<"idle" | "pending" | "started" | "error">("idle");
  const zipInFlight = useRef(false);
  const download = localKitDownload(artist.image, artist.id);
  const profileHref = `/artists/${encodeURIComponent(artist.id)}`;

  async function downloadKit() {
    if (zipInFlight.current) return;
    zipInFlight.current = true;
    setZipState("pending");
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 30_000);
    let objectUrl: string | null = null;
    let anchor: HTMLAnchorElement | null = null;
    try {
      const response = await fetch(`/api/agency/artists/${encodeURIComponent(artist.id)}/kit`, {
        method: "GET",
        headers: { Accept: "application/zip" },
        signal: controller.signal,
      });
      if (!response.ok || response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/zip") {
        throw new Error("Kit unavailable");
      }
      const blob = await response.blob();
      if (!blob.size) throw new Error("Empty kit");
      const suppliedName = /(?:^|;)\s*filename="?([^";]+)"?/i.exec(response.headers.get("content-disposition") || "")?.[1]?.trim();
      const fallbackName = `bright-ears-${artist.id.replace(/[^a-z0-9_-]/gi, "-").slice(0,80) || "artist"}-promotion-kit.zip`;
      const filename = suppliedName && /^[a-z0-9][a-z0-9_-]{0,140}\.zip$/i.test(suppliedName) ? suppliedName : fallbackName;
      objectUrl = URL.createObjectURL(blob);
      anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      setZipState("started");
    } catch {
      setZipState("error");
    } finally {
      anchor?.remove();
      // Let the browser begin the download before releasing its temporary URL.
      if (objectUrl) {
        const downloadedUrl = objectUrl;
        window.setTimeout(() => URL.revokeObjectURL(downloadedUrl), 1_000);
      }
      window.clearTimeout(timeout);
      zipInFlight.current = false;
    }
  }

  async function copyBio() {
    try {
      await navigator.clipboard.writeText(bio);
      setStatus(c("Biography copied.", "คัดลอกประวัติแล้ว"));
    } catch {
      biography.current?.focus();
      biography.current?.select();
      setStatus(c("Select and copy the biography below.", "เลือกและคัดลอกประวัติด้านล่าง"));
    }
  }

  return <div className={styles.page} lang={th ? "th" : "en"}>
    <Link href={profileHref} className={styles.back}>← {c("Artist profile", "โปรไฟล์ศิลปิน")}</Link>
    <header className={styles.header}><div><p className={styles.eyebrow}>{c("BRIGHT EARS / PROMOTION KIT", "BRIGHT EARS / สื่อประชาสัมพันธ์")}</p><h1>{artist.name}</h1></div><p>{c("Photo, biography and links from the public Bright Ears profile.", "ภาพ ประวัติ และลิงก์จากโปรไฟล์สาธารณะบน Bright Ears")}</p></header>

    <div className={styles.kitDownload}>
      <div className={styles.kitDownloadAction}>
        <button type="button" onClick={downloadKit} className={`${styles.primary} ${styles.kitDownloadButton}`} disabled={zipState === "pending"} aria-busy={zipState === "pending"} aria-describedby="kit-download-help kit-download-status">
          {zipState === "pending" ? c("Preparing ZIP…", "กำลังเตรียมไฟล์ ZIP…") : c("Download promotion kit (ZIP)", "ดาวน์โหลดชุดสื่อประชาสัมพันธ์ (ZIP)")} <span aria-hidden="true">↓</span>
        </button>
        <p id="kit-download-status" className={`${styles.status} ${zipState === "error" ? styles.kitDownloadError : ""}`} role="status" aria-live="polite" aria-atomic="true">
          {zipState === "pending" ? c("Preparing your promotion kit…", "กำลังจัดเตรียมชุดสื่อประชาสัมพันธ์…") : zipState === "started" ? c("ZIP download started.", "เริ่มดาวน์โหลดไฟล์ ZIP แล้ว") : zipState === "error" ? c("We couldn't prepare the ZIP. Please try again, or use the photo and biography controls below.", "ไม่สามารถจัดเตรียมไฟล์ ZIP ได้ ลองอีกครั้ง หรือดาวน์โหลดภาพและคัดลอกประวัติจากส่วนด้านล่าง") : ""}
        </p>
      </div>
      <p id="kit-download-help" className={styles.kitDownloadHelp}>{c("Public biographies, links and the available website photo in one ZIP. Images hosted elsewhere are included as links.", "รวมประวัติสาธารณะ ลิงก์ และภาพจากเว็บไซต์ที่มีให้ดาวน์โหลดไว้ใน ZIP เดียว ภาพจากเว็บไซต์ภายนอกจะรวมไว้เป็นลิงก์")}</p>
    </div>

    <div className={styles.grid}>
      <section className={styles.photoPanel} aria-labelledby="kit-photo-title">
        <div className={styles.panelHeading}><h2 id="kit-photo-title">{c("Artist photo", "ภาพศิลปิน")}</h2><span>01</span></div>
        {artist.image && !imageFailed ? <>
          <div className={styles.photo}>
            <Image src={artist.image} alt={artist.name} fill unoptimized sizes="(max-width: 750px) 88vw, 36vw" onLoad={event => setImageSize({width:event.currentTarget.naturalWidth,height:event.currentTarget.naturalHeight})} onError={() => setImageFailed(true)}/>
          </div>
          <p className={styles.imageLabel}>{c("Website image", "ภาพที่ใช้บนเว็บไซต์")}{imageSize ? ` · ${imageSize.width} × ${imageSize.height} px` : ""}</p>
          <div className={styles.actions}>{download ? <a className={styles.primary} href={download.href} download={download.filename}>{c("Download website photo", "ดาวน์โหลดภาพจากเว็บไซต์")} <span aria-hidden>↓</span></a> : <a className={styles.primary} href={artist.image} target="_blank" rel="noopener noreferrer">{c("Open published image", "เปิดภาพที่เผยแพร่")} <span aria-hidden>↗</span></a>}</div>
          <p className={styles.note}>{download ? c("This is the file used on our website. Need a larger photo or another format? Contact our team.", "ไฟล์นี้เป็นภาพที่ใช้บนเว็บไซต์ของเรา หากต้องการภาพขนาดใหญ่ขึ้นหรือรูปแบบอื่น ติดต่อทีมของเราได้") : c("This image is hosted outside this website. Open it at its source, or ask our team for another format.", "ภาพนี้อยู่บนเว็บไซต์ภายนอก เปิดภาพจากแหล่งที่มา หรือติดต่อทีมเพื่อขอรูปแบบอื่น")}</p>
        </> : <div className={styles.empty}><span aria-hidden="true">{artist.name.slice(0,2).toUpperCase()}</span><p>{imageFailed ? c("The published photo could not be loaded.", "ไม่สามารถโหลดภาพที่เผยแพร่ได้") : c("A public photo is not available yet.", "ยังไม่มีภาพสาธารณะสำหรับศิลปินคนนี้")}</p><a href="https://page.line.me/944grjuq">{c("Ask Bright Ears for a photo", "ขอภาพจากทีม Bright Ears")} ↗</a></div>}
      </section>

      <div className={styles.details}>
        <section className={styles.bioPanel} aria-labelledby="kit-bio-title">
          <div className={styles.panelHeading}><h2 id="kit-bio-title">{c("Biography", "ประวัติศิลปิน")}</h2><span>02</span></div>
          {artist.genres.length > 0 && <p className={styles.genres}>{artist.genres.join(" / ")}</p>}
          {bio ? <>
            <label className={styles.bioLabel} htmlFor="kit-biography">{bioLanguage === "th" ? c("Thai biography", "ประวัติภาษาไทย") : c("English biography", "ประวัติภาษาอังกฤษ")}</label>
            <textarea ref={biography} id="kit-biography" lang={bioLanguage} value={bio} readOnly className={styles.biography} rows={Math.min(12,Math.max(5,Math.ceil(bio.length/66)))}/>
            <button type="button" onClick={copyBio} className={styles.primary}>{c("Copy biography", "คัดลอกประวัติ")} <span aria-hidden>⧉</span></button>
            <p className={styles.status} role="status" aria-live="polite">{status}</p>
          </> : <p className={styles.note}>{c("A public biography is not available yet. Contact Bright Ears for an introduction.", "ยังไม่มีประวัติสาธารณะสำหรับศิลปินคนนี้ ติดต่อ Bright Ears เพื่อขอข้อมูลเพิ่มเติม")}</p>}
        </section>

        <section className={styles.linksPanel} aria-labelledby="kit-links-title"><div className={styles.panelHeading}><h2 id="kit-links-title">{c("Music & social", "ดนตรีและโซเชียล")}</h2><span>03</span></div>{artist.links.length ? <div className={styles.publicLinks}>{artist.links.map(link => <a key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">{link.label} <span aria-hidden>↗</span></a>)}</div> : <p className={styles.note}>{c("No public music or social links have been added. Ask our team for a music reference.", "ยังไม่มีลิงก์ดนตรีหรือโซเชียลสาธารณะ สามารถขอตัวอย่างดนตรีจากทีมของเราได้")}</p>}</section>
      </div>
    </div>

    <aside className={styles.contact}><div><h2>{c("Need something else?", "ต้องการข้อมูลเพิ่มเติม?")}</h2><p>{c("For another photo, format or music reference, tell us the artist and what you are preparing.", "หากต้องการภาพอื่น รูปแบบไฟล์อื่น หรือตัวอย่างดนตรี แจ้งชื่อศิลปินและสิ่งที่กำลังจัดเตรียมให้เราทราบ")}</p></div><a href="https://page.line.me/944grjuq" className={styles.primary}>{c("Contact Bright Ears", "ติดต่อ Bright Ears")} <span aria-hidden>↗</span></a></aside>
  </div>;
}
