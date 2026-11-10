import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { AgencyBrief } from "@/components/agency-brief";
import { AgencyMotion } from "@/components/agency-motion";
import { heroArtists } from "@/lib/agency/roster";
import type { InquirySource } from "@/lib/agency/inquiry-contract";
import agency from "@/app/(marketing)/agency.module.css";
import styles from "@/app/(marketing)/services.module.css";
import landing from "@/app/(marketing)/landing.module.css";

export type Copy = { en: string; th: string };
export type LandingConfig = {
  eyebrow: Copy; title: [Copy, Copy]; intro: Copy; action: Copy;
  heroArtistId?: string; stamp?: string; heroPanel?: Copy[];
  /** Current, verified programmes only. Names and logos already public on the site. */
  evidence?: { heading: Copy; note: Copy; items: { name: string; place: Copy; logo?: { src: string; width: number; invert?: boolean } }[] };
  formats?: { heading: Copy; items: Copy[] };
  stepsHeading: [Copy, Copy, Copy]; steps: { title: Copy; body: Copy }[];
  questions: { q: Copy; a: Copy }[];
  other: { text: Copy; href: string; link: Copy }[];
  brief: { occasion: Copy; source: InquirySource; venueType?: string; actType?: string; date?: string };
};

export function AgencyLandingPage({ config, th, children }: { config: LandingConfig; th: boolean; children?: ReactNode }) {
  const t = (copy: Copy) => th ? copy.th : copy.en;
  const hero = heroArtists.find(artist => artist.id === config.heroArtistId);
  return <AgencyMotion><div className={styles.page} lang={th ? "th" : "en"}>
    <section className={styles.hero} aria-labelledby="landing-title">
      <div className={styles.heroCopy}>
        <p className={styles.eyebrow}>{t(config.eyebrow)}</p>
        <h1 id="landing-title">{t(config.title[0])}<br/><em>{t(config.title[1])}</em></h1>
        <p className={styles.intro}>{t(config.intro)}</p>
        <div className={styles.actions}><a className={agency.primary} href="#brief">{t(config.action)}<span aria-hidden>↗</span></a><Link className={agency.textLink} href="/artists">{th ? "รู้จักศิลปินของเรา" : "Meet the roster"} <span aria-hidden>↗</span></Link></div>
        <p className={styles.location}>{th ? "BRIGHT EARS / กรุงเทพฯ และพัทยา" : "BRIGHT EARS / BANGKOK & PATTAYA"}</p>
      </div>
      {hero ? <figure className={styles.heroPhoto}>
        <Image src={hero.image} alt={hero.name} fill sizes="(max-width: 800px) 88vw, 46vw" preload style={{ objectPosition: hero.position }}/>
        {config.stamp && <span className={styles.photoStamp} aria-hidden="true">{config.stamp}</span>}
        <figcaption><span>{th ? "ผู้คนเบื้องหลังเสียงดนตรี" : "THE PEOPLE BEHIND THE MUSIC"}</span><Link href={"/artists/" + encodeURIComponent(hero.id)}>{hero.name} <span aria-hidden>↗</span></Link></figcaption>
      </figure> : config.heroPanel && <ul className={landing.heroPanel} aria-label={th ? "รูปแบบการแสดง" : "Act formats"}>
        {config.heroPanel.map((item, i) => <li key={item.en}><span aria-hidden="true">0{i + 1}</span>{t(item)}</li>)}
      </ul>}
    </section>

    {config.evidence && <section className={landing.evidence} aria-labelledby="evidence-title">
      <div><p className={styles.eyebrow}>{t(config.evidence.heading)}</p><p id="evidence-title" className={landing.evidenceNote}>{t(config.evidence.note)}</p></div>
      <ul>{config.evidence.items.map(item => <li key={item.name}>
        {item.logo ? <Image src={item.logo.src} alt="" width={item.logo.width} height={48} className={item.logo.invert ? landing.invert : undefined}/> : <span className={landing.logoSpace} aria-hidden="true"/>}
        <strong>{item.name}</strong><span>{t(item.place)}</span>
      </li>)}</ul>
    </section>}

    {children}

    <section className={styles.approach} aria-labelledby="approach-title">
      <div className={styles.sectionHeading} data-reveal><p className={styles.eyebrow}>{t(config.stepsHeading[0])}</p><h2 id="approach-title">{t(config.stepsHeading[1])}<br/><em>{t(config.stepsHeading[2])}</em></h2>
        {config.formats && <div className={landing.formats}><h3>{t(config.formats.heading)}</h3><ul>{config.formats.items.map(item => <li key={item.en}>{t(item)}</li>)}</ul></div>}
      </div>
      <ol className={styles.steps}>{config.steps.map((step, i) => <li key={step.title.en} data-reveal><span className={styles.stepNumber} aria-hidden="true">0{i + 1}</span><div><h3>{t(step.title)}</h3><p>{t(step.body)}</p></div></li>)}</ol>
    </section>

    <section className={styles.questions} aria-labelledby="questions-title"><div><p className={styles.eyebrow}>{th ? "ก่อนเริ่มงานด้วยกัน" : "BEFORE WE BEGIN"}</p><h2 id="questions-title">{th ? "รายละเอียดที่ควรรู้" : "A few details."}</h2></div><div>{config.questions.map(({ q, a }) => <details key={q.en}><summary>{t(q)}<span aria-hidden="true">+</span></summary><p>{t(a)}</p></details>)}</div></section>
    {config.other.map(item => <aside key={item.href} className={styles.otherService}><p>{t(item.text)}</p><Link href={item.href}>{t(item.link)} <span aria-hidden>↗</span></Link></aside>)}
    <section id="brief" className={`${agency.briefSection} ${styles.brief}`}><AgencyBrief key={config.brief.actType ?? ""} th={th} initialOccasion={t(config.brief.occasion)} initialVenueType={config.brief.venueType} initialActType={config.brief.actType} initialDate={config.brief.date} source={config.brief.source}/></section>
  </div></AgencyMotion>;
}
