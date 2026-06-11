"use client";

// Presentational nav links for the dashboard shell. Client component only
// because the active state needs usePathname() — layout.tsx owns the link list.
//
// v2 (docs/DESIGN.md): links sit on the ink nav bar — cream text, and the
// active page is a solid CYAN pill with ink text (cyan = the interface voice).
import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashboardNavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1.5 text-sm">
      {links.map((link) => {
        const active =
          link.href === "/dashboard"
            ? pathname === "/dashboard" || pathname.startsWith("/dashboard/leads")
            : pathname.startsWith(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 transition-colors ${
              active
                ? "bg-brand-cyan font-bold text-ink-stage"
                : "font-medium text-cream/60 hover:text-cream-bright"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
