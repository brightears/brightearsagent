import type { Metadata } from "next";
import { AgencyLandingPage } from "@/components/agency-landing-page";
import { NEW_YEARS_EVE } from "@/lib/agency/landing-pages";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const th = (await getRequestLocale()) === "th";
  return {
    title: th ? "ดีเจ ดนตรีสด และพิธีกรสำหรับคืนส่งท้ายปีเก่า — Bright Ears" : "New Year’s Eve DJs, live music & MCs — Bright Ears",
    description: th ? "ดีเจ นักดนตรีสด และพิธีกร สำหรับงานเคาต์ดาวน์คืนส่งท้ายปีเก่าในโรงแรม รูฟท็อป และงานส่วนตัวในกรุงเทพฯ และพัทยา" : "DJs, live musicians and MCs for New Year’s Eve countdown parties at hotels, rooftops and private events in Bangkok and Pattaya.",
    alternates: { canonical: "/events/new-years-eve" },
  };
}

export default async function NewYearsEvePage() {
  return <AgencyLandingPage config={NEW_YEARS_EVE} th={(await getRequestLocale()) === "th"}/>;
}
