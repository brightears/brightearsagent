"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { LanguageSwitcher } from "@/components/language-switcher";
import styles from "@/app/(marketing)/agency.module.css";
export function AgencyMenu({ links, th }: { links: { href: string; label: string }[]; th: boolean }) {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function close(event: KeyboardEvent) { if (event.key === "Escape" && open) { setOpen(false); trigger.current?.focus(); } }
    document.addEventListener("keydown", close);
    return () => document.removeEventListener("keydown", close);
  }, [open]);
  return <div className={styles.mobileNav}><LanguageSwitcher compact /><button ref={trigger} className={styles.menuButton} type="button" aria-expanded={open} aria-controls="agency-navigation" onClick={() => setOpen(!open)}>{open ? (th ? "ปิด" : "Close") : (th ? "เมนู" : "Menu")} <span aria-hidden>{open ? "−" : "+"}</span></button>
    {open && <nav id="agency-navigation" className={styles.menuPanel} aria-label={th ? "เมนูหลัก" : "Main navigation"}>{links.map(link => <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}<span aria-hidden>↗</span></Link>)}<a href="https://page.line.me/944grjuq">{th ? "คุยกับเราทาง LINE" : "Talk to us on LINE"} ↗</a></nav>}
  </div>;
}
