"use client";

// Control Room section rail (Phase 2b). One coherent cockpit instead of two
// scattered settings pages: a sticky vertical rail on desktop, a sticky
// horizontal chip bar on phones, both tracking the section in view.
//
// Progressive enhancement (docs/DESIGN.md ethos — never lose function if JS
// fails): the items are real anchor links (<a href="#id">), so clicking jumps
// natively even with JS off; scroll-margin on the sections (set by the page)
// keeps the heading clear of the sticky bar. JS upgrades the jump to a smooth
// scroll, lights the section in view, keeps the URL hash in sync, centers the
// active chip on mobile, and moves focus into the section for keyboard/SR users.
//
// Active section = the LAST section whose top has scrolled above an activation
// line ~30% down the viewport (the classic "current heading" model). Computed
// from scroll position rather than an IntersectionObserver band so the FIRST
// section lights at the very top and the LAST lights at the very bottom — both
// of which a fixed center-band misses.
//
// On-brand: mono ALL-CAPS tracked labels (the Kicker voice); active = cyan
// (the interface accent) — a lit segment on the rail, a cyan pill on mobile.
// No emoji ever.

import { useEffect, useRef, useState } from "react";

export type ControlRoomSection = { id: string; label: string };

export function ControlRoomNav({ sections }: { sections: ControlRoomSection[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? "");
  // Stable dependency: the section ids, not the array identity.
  const ids = sections.map((s) => s.id).join(",");

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const chipRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const firstActiveRun = useRef(true);

  // Track the section in view from scroll position (rAF-throttled).
  useEffect(() => {
    const els = sections
      .map((s) => [s.id, document.getElementById(s.id)] as const)
      .filter((pair): pair is readonly [string, HTMLElement] => pair[1] !== null);
    if (els.length === 0) return;

    let raf = 0;
    const compute = () => {
      raf = 0;
      const line = window.innerHeight * 0.3;
      let current = els[0][0];
      for (const [id, el] of els) {
        // Sections are in document order, top to bottom — once one starts below
        // the line, every later one does too, so the last one above the line is
        // the section in view.
        if (el.getBoundingClientRect().top <= line) current = id;
        else break;
      }
      // At the very bottom of the page the last section may be too short to ever
      // push its top above the line — force it active so the rail reaches the
      // final item (e.g. a short subscribed-state billing card).
      const atBottom =
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 2;
      if (atBottom) current = els[els.length - 1][0];
      setActive((prev) => (prev === current ? prev : current));
    };

    // Seed from the URL hash on arrival (deep-link to #profile etc.) so the
    // first frame lands close before scroll math refines it; then compute.
    const hash = window.location.hash.slice(1);
    if (hash && els.some(([id]) => id === hash)) setActive(hash);
    compute();

    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(compute);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids]);

  // On active change: keep the URL hash in sync (replaceState, no history spam)
  // and center the active chip in the mobile scroller. Skip the first run so a
  // clean /dashboard/settings URL isn't stamped with #identity on load.
  useEffect(() => {
    if (firstActiveRun.current) {
      firstActiveRun.current = false;
      return;
    }
    if (active) {
      try {
        history.replaceState(null, "", `#${active}`);
      } catch {
        // replaceState can throw in rare sandboxed contexts — non-fatal.
      }
    }
    const chip = chipRefs.current[active];
    const scroller = scrollerRef.current;
    if (chip && scroller) {
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const target = chip.offsetLeft - (scroller.clientWidth - chip.clientWidth) / 2;
      scroller.scrollTo({ left: Math.max(0, target), behavior: reduce ? "auto" : "smooth" });
    }
  }, [active]);

  function jump(e: React.MouseEvent, id: string) {
    const el = document.getElementById(id);
    if (!el) return; // let the native anchor handle it
    e.preventDefault();
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    setActive(id);
    // Move focus into the section so keyboard/SR users continue from there, not
    // from the rail link (the section is not natively focusable).
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  }

  return (
    <>
      {/* Mobile: sticky horizontal chip bar. The dashboard top nav isn't sticky,
          so this rides the very top once you scroll. */}
      <nav
        aria-label="Control room sections"
        className="lg:hidden sticky top-0 z-20 -mx-6 mb-6 border-b border-cream/10 bg-ink-stage/80 px-6 py-3 backdrop-blur supports-[backdrop-filter]:bg-ink-stage/65"
      >
        <div ref={scrollerRef} className="flex gap-2 overflow-x-auto">
          {sections.map((s) => (
            <a
              key={s.id}
              ref={(node) => {
                chipRefs.current[s.id] = node;
              }}
              href={`#${s.id}`}
              onClick={(e) => jump(e, s.id)}
              aria-current={active === s.id ? "true" : undefined}
              className={`shrink-0 rounded-full px-3 py-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors ${
                active === s.id
                  ? "bg-brand-cyan text-ink-stage"
                  : "bg-ink-raised text-cream/55 hover:text-cream-bright"
              }`}
            >
              {s.label}
            </a>
          ))}
        </div>
      </nav>

      {/* Desktop: sticky vertical rail — a lit cyan segment marks the section
          in view, like a channel strip. */}
      <nav
        aria-label="Control room sections"
        className="hidden lg:block lg:sticky lg:top-8 lg:self-start"
      >
        <ul className="space-y-0.5">
          {sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                onClick={(e) => jump(e, s.id)}
                aria-current={active === s.id ? "true" : undefined}
                className={`block border-l-2 py-1.5 pl-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] transition-colors ${
                  active === s.id
                    ? "border-brand-cyan text-cream-bright"
                    : "border-cream/15 text-cream/60 hover:border-cream/40 hover:text-cream-bright"
                }`}
              >
                {s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}
