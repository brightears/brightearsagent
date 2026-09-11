import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AgencyPromotionKit } from "@/components/agency-promotion-kit";
import { getAgencyRoster } from "@/lib/agency/roster";
import { getRequestLocale } from "@/lib/i18n/server";
import styles from "@/components/agency-promotion-kit.module.css";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const [roster, locale] = await Promise.all([getAgencyRoster(), getRequestLocale()]);
  const artist = roster.find(item => item.id === id);
  const th = locale === "th";
  return {
    title: artist ? `${artist.name} — ${th ? "ภาพและประวัติสำหรับประชาสัมพันธ์" : "Photo & bio kit"} — Bright Ears` : "Artist promotion kit — Bright Ears",
    description: th ? "ภาพ ประวัติ และลิงก์ดนตรีจากโปรไฟล์สาธารณะของศิลปินบน Bright Ears" : "Photo, biography and music links from this artist’s public Bright Ears profile.",
    alternates: { canonical: `/artists/${encodeURIComponent(id)}/kit` },
    ...(!artist ? { robots: { index: false, follow: true } } : {}),
  };
}

export default async function ArtistKitPage({ params }: Props) {
  const { id } = await params;
  const [roster, locale] = await Promise.all([getAgencyRoster(), getRequestLocale()]);
  const artist = roster.find(item => item.id === id);
  const th = locale === "th";
  if (!artist) {
    if (!roster.length) return <div className={styles.page}><h1 className={styles.unavailable}>{th ? "ข้อมูลศิลปินไม่พร้อมใช้งานชั่วคราว" : "Artist materials are temporarily unavailable."}</h1><p>{th ? "ลองอีกครั้ง หรือติดต่อทีม Bright Ears เพื่อขอข้อมูล" : "Please try again, or contact Bright Ears for the material you need."}</p><div className={styles.actions}><Link href="/artists">{th ? "กลับไปดูดีเจ" : "Back to the roster"}</Link><a href="https://page.line.me/944grjuq">LINE ↗</a></div></div>;
    notFound();
  }
  return <AgencyPromotionKit key={`${artist.id}:${locale}`} artist={artist} th={th}/>;
}
