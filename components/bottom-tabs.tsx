"use client";

// Bottom tab bar (P9.3) — the standard IA for a daily-check app. Five
// dashboard sections in an unhinted horizontal scroll meant artists never
// found Calendar or the Control room on a phone; thumb-reach tabs fix the
// discovery AND the reach. lg+ keeps the top nav; this renders below it.
// Ink bar, cyan active (interface voice), mono labels, safe-area padding.
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard", label: "Today" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/results", label: "Results" },
  { href: "/dashboard/packages", label: "Packages" },
  { href: "/dashboard/settings", label: "Control" },
];

export function BottomTabs({ pendingCount = 0 }: { pendingCount?: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Dashboard sections"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-cream/10 bg-ink-stage/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map((tab) => {
          const active =
            tab.href === "/dashboard"
              ? pathname === "/dashboard" || pathname.startsWith("/dashboard/leads")
              : pathname.startsWith(tab.href);
          const badge = tab.href === "/dashboard" && pendingCount > 0;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 px-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] transition-colors ${
                active ? "text-brand-cyan" : "text-cream/55 hover:text-cream/80"
              }`}
            >
              {/* Active = a cyan tick above the label (typography-first; no icon set). */}
              <span
                aria-hidden
                className={`h-0.5 w-6 rounded-full ${active ? "bg-brand-cyan" : "bg-transparent"}`}
              />
              <span className="relative">
                {tab.label}
                {badge && (
                  <span className="absolute -right-4 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon-magenta px-1 font-mono text-[9px] font-bold text-white">
                    {pendingCount > 9 ? "9+" : pendingCount}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
