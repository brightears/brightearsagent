import Link from "next/link";
import { BrightEarsLogo } from "@/components/ui";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getRequestLocale } from "@/lib/i18n/server";
import { AgencyMenu } from "@/components/agency-menu";
import styles from "./agency.module.css";
import { Manrope, Playfair_Display } from "next/font/google";
const sans = Manrope({ subsets: ["latin"], variable: "--agency-sans", display: "swap" });
const serif = Playfair_Display({ subsets: ["latin"], style: ["normal", "italic"], variable: "--agency-serif", display: "swap" });

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const th = (await getRequestLocale()) === "th";
  const links = [{ href: "/venues", label: th ? "สำหรับสถานที่" : "For venues" }, { href: "/events", label: th ? "สำหรับอีเวนต์" : "For events" }, { href: "/artists", label: th ? "ดีเจ" : "The roster" }, { href: "/#your-space", label: th ? "พื้นที่ของคุณ" : "Your space" }];
  return <div className={`${styles.shell} ${sans.variable} ${serif.variable}`}>
    <a className={styles.skip} href="#main-content">{th ? "ข้ามไปเนื้อหา" : "Skip to content"}</a>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/" className={styles.wordmark} aria-label="Bright Ears home"><BrightEarsLogo size={44} /><span>bright ears<span className={styles.brandDot}>.</span></span></Link>
      <nav className={styles.desktopNav} aria-label={th ? "เมนูหลัก" : "Main navigation"}>{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}<LanguageSwitcher compact /><Link href="/#brief" className={styles.navCta}>{th ? "คุยกับเรา" : "Let’s talk"}<span aria-hidden>↗</span></Link></nav>
      <AgencyMenu links={links} th={th} />
    </div></header>
    <main id="main-content" className={styles.main}>{children}</main>
    <footer className={styles.footer}>
      <div className={styles.footerTop}><Link href="/" className={styles.wordmark}><BrightEarsLogo size={32} /><span>bright ears.</span></Link><p>{th ? "ดนตรีที่ใช่ สำหรับสถานที่ของคุณ" : "Good company. Better music."}</p><a href="mailto:info@brightears.io">info@brightears.io <span aria-hidden>↗</span></a></div>
      <div className={styles.footerBig} aria-hidden="true">ALL EARS<span>↗</span></div>
      <div className={styles.footerBottom}><span>© {new Date().getFullYear()} Bright Ears Co., Ltd. · Bangkok</span><nav aria-label={th ? "ลิงก์เพิ่มเติม" : "Additional links"}><a href="https://instagram.com/brightearsgroup">Instagram ↗</a><a href={`https://agency.brightears.io/${th?"th":"en"}/venue-portal`}>{th ? "เข้าสู่ระบบสถานที่" : "Venue access"}</a><a href={`https://agency.brightears.io/${th?"th":"en"}/dj-portal`}>{th?"เข้าสู่ระบบดีเจ":"DJ access"}</a><Link href="/discover">{th ? "ค้นหางานสำหรับดีเจ" : "Discovery for DJs"}</Link><Link href="/assistant">{th ? "บัญชีผู้ช่วยเดิม" : "Assistant accounts"}</Link><Link href="/privacy">{th ? "ความเป็นส่วนตัว" : "Privacy"}</Link><Link href="/terms">{th ? "ข้อกำหนด" : "Terms"}</Link></nav></div>
    </footer>
  </div>;
}
