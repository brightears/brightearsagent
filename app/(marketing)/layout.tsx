import Link from "next/link";
import { BrightEarsLogo } from "@/components/ui";
import { LanguageSwitcher } from "@/components/language-switcher";
import { getRequestLocale } from "@/lib/i18n/server";
import { AgencyMenu } from "@/components/agency-menu";
import styles from "./agency.module.css";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  const th = (await getRequestLocale()) === "th";
  const links = [{ href: "/#approach", label: th ? "บริการ" : "What we do" }, { href: "/#artists", label: th ? "ดีเจ" : "The DJs" }, { href: "/#brief", label: th ? "ติดต่อ" : "Make a brief" }];
  return <div className={styles.shell}>
    <a className={styles.skip} href="#main-content">{th ? "ข้ามไปเนื้อหา" : "Skip to content"}</a>
    <header className={styles.header}><div className={styles.headerInner}>
      <Link href="/" className={styles.wordmark} aria-label="Bright Ears home"><BrightEarsLogo size={44} /><span>bright ears<span className={styles.brandDot}>.</span></span></Link>
      <nav className={styles.desktopNav} aria-label={th ? "เมนูหลัก" : "Main navigation"}>{links.map(link => <Link key={link.href} href={link.href}>{link.label}</Link>)}<LanguageSwitcher compact /><a href="https://page.line.me/944grjuq" className={styles.navCta}>{th ? "คุยกับเรา" : "Let’s talk"}<span aria-hidden>↗</span></a></nav>
      <AgencyMenu links={links} th={th} />
    </div></header>
    <main id="main-content" className={styles.main}>{children}</main>
    <footer className={styles.footer}>
      <div className={styles.footerTop}><Link href="/" className={styles.wordmark}><BrightEarsLogo size={32} /><span>bright ears.</span></Link><p>{th ? "ดนตรีที่ใช่ สำหรับสถานที่ของคุณ" : "Good company. Better music."}</p><a href="mailto:info@brightears.io">info@brightears.io <span aria-hidden>↗</span></a></div>
      <div className={styles.footerBottom}><span>© {new Date().getFullYear()} Bright Ears Co., Ltd.</span><nav aria-label={th ? "ลิงก์เพิ่มเติม" : "Additional links"}><a href="https://instagram.com/brightearsgroup">Instagram ↗</a><a href="https://agency.brightears.io/venue-portal">{th ? "เข้าสู่ระบบสถานที่" : "Venue portal"}</a><Link href="/assistant">{th ? "บัญชีผู้ช่วยเดิม" : "Existing assistant accounts"}</Link><Link href="/privacy">{th ? "ความเป็นส่วนตัว" : "Privacy"}</Link><Link href="/terms">{th ? "ข้อกำหนด" : "Terms"}</Link></nav></div>
    </footer>
  </div>;
}
