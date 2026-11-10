import type { Metadata } from "next";
import { AgencyLandingPage } from "@/components/agency-landing-page";
import { BANGKOK } from "@/lib/agency/landing-pages";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const th = (await getRequestLocale()) === "th";
  return {
    title: th ? "ดีเจสำหรับโรงแรมและรูฟท็อปในกรุงเทพฯ — Bright Ears" : "Hotel & rooftop DJs in Bangkok — Bright Ears",
    description: th ? "ดีเจประจำและดีเจรับเชิญสำหรับบาร์ในโรงแรม รูฟท็อป และร้านอาหารในกรุงเทพฯ วางแนวดนตรี ดูแลตาราง และหาดีเจแทนโดยทีมเดียว" : "Resident and guest DJs for Bangkok hotel bars, rooftops and restaurants. Music direction, scheduling and cover from one team, with current programmes at Nobu Bangkok, Le Du Kaan and ABar.",
    alternates: { canonical: "/venues/bangkok" },
  };
}

export default async function BangkokPage() {
  return <AgencyLandingPage config={BANGKOK} th={(await getRequestLocale()) === "th"}/>;
}
