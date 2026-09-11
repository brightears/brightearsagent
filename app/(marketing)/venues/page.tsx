import type { Metadata } from "next";
import { AgencyServicePage } from "@/components/agency-service-page";
import { getRequestLocale } from "@/lib/i18n/server";

export async function generateMetadata(): Promise<Metadata> {
  const th = (await getRequestLocale()) === "th";
  return {
    title: th ? "ดีเจและโปรแกรมดนตรีสำหรับสถานที่ — Bright Ears" : "Resident DJs & venue music programmes — Bright Ears",
    description: th ? "ดีเจประจำและดีเจรับเชิญสำหรับโรงแรม รูฟท็อป และร้านอาหารในกรุงเทพฯ และพัทยา พร้อมวางแนวดนตรี ประสานตาราง และรับความคิดเห็นผ่าน LINE" : "Resident and guest DJs for hotels, rooftops and restaurants in Bangkok and Pattaya. Music direction, scheduling and feedback through one team.",
    alternates: { canonical: "/venues" },
  };
}

export default async function VenuesPage() {
  return <AgencyServicePage kind="venues" th={(await getRequestLocale()) === "th"}/>;
}
