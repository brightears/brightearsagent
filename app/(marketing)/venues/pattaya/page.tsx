import type { Metadata } from "next";
import { AgencyLandingPage } from "@/components/agency-landing-page";
import { PATTAYA } from "@/lib/agency/landing-pages";
import { getRequestLocale } from "@/lib/i18n/server";
import { localizedPageMeta } from "@/lib/marketing/site";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const th = locale === "th";
  return localizedPageMeta({
    path: "/venues/pattaya",
    locale,
    title: th ? "ดีเจสำหรับโรงแรมและรูฟท็อปในพัทยา — Bright Ears" : "Hotel & rooftop DJs in Pattaya — Bright Ears",
    description: th ? "ดีเจสำหรับโรงแรม รูฟท็อป และสถานที่ริมทะเลในพัทยา Bright Ears ดูแลโปรแกรมดนตรีเฮาส์ทุกคืนที่ Horizon, Hilton Pattaya" : "DJs for Pattaya hotels, rooftops and beach venues. Bright Ears runs the nightly house programme at Horizon, Hilton Pattaya.",
  });
}

export default async function PattayaPage() {
  return <AgencyLandingPage config={PATTAYA} th={(await getRequestLocale()) === "th"}/>;
}
