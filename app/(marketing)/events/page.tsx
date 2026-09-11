import type { Metadata } from "next";
import { AgencyServicePage } from "@/components/agency-service-page";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const th = (await getRequestLocale()) === "th";
  return {
    title: th ? "ดีเจสำหรับอีเวนต์และทีมผู้จัดงาน — Bright Ears" : "Event DJs & music for event planners — Bright Ears",
    description: th ? "ดีเจสำหรับงานบริษัท งานเลี้ยงรับรอง งานเปิดตัว และงานส่วนตัวในกรุงเทพฯ และพัทยา เลือกศิลปินและตกลงขอบเขตงานกับ Bright Ears" : "DJs for corporate events, receptions, launches and private celebrations in Bangkok and Pattaya. Artist supply for planners with a clearly agreed scope.",
    alternates: { canonical: "/events" },
  };
}

export default async function EventsPage() {
  return <AgencyServicePage kind="events" th={(await getRequestLocale()) === "th"}/>;
}
