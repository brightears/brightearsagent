import type { Metadata } from "next";
import { AgencyLandingPage } from "@/components/agency-landing-page";
import { PATTAYA } from "@/lib/agency/landing-pages";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const th = (await getRequestLocale()) === "th";
  return {
    title: th ? "ดีเจสำหรับโรงแรมและรูฟท็อปในพัทยา — Bright Ears" : "Hotel & rooftop DJs in Pattaya — Bright Ears",
    description: th ? "ดีเจสำหรับโรงแรม รูฟท็อป และสถานที่ริมทะเลในพัทยา Bright Ears ดูแลโปรแกรมดนตรีเฮาส์ทุกคืนที่ Horizon, Hilton Pattaya" : "DJs for Pattaya hotels, rooftops and beach venues. Bright Ears runs the nightly house programme at Horizon, Hilton Pattaya.",
    alternates: { canonical: "/venues/pattaya" },
  };
}

export default async function PattayaPage() {
  return <AgencyLandingPage config={PATTAYA} th={(await getRequestLocale()) === "th"}/>;
}
