"use client";

// Presentational nav links for the dashboard shell. Client component only
// because the active state needs usePathname() — layout.tsx owns the link list.
import Link from "next/link";
import { usePathname } from "next/navigation";

export function DashboardNavLinks({ links }: { links: { href: string; label: string }[] }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center gap-1 text-sm">
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
            className={`rounded-full px-3 py-1.5 transition-colors ${
              active
                ? "bg-brand-cyan-soft/40 font-semibold text-brand-cyan"
                : "font-medium text-ink/60 hover:text-brand-cyan"
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
