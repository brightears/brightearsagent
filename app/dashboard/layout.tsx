import Image from "next/image";
import Link from "next/link";
import { UserButton } from "@clerk/nextjs";

const NAV = [
  { href: "/dashboard", label: "Pipeline" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/packages", label: "Packages" },
  { href: "/dashboard/settings", label: "Settings" },
];

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex flex-col">
      <nav className="border-b border-off-white bg-white">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Image src="/brand/logo.svg" alt="Bright Ears" width={28} height={28} />
            <span className="font-bold text-deep-teal">Bright Ears</span>
          </Link>
          <div className="flex gap-4 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className="text-ink/70 hover:text-brand-cyan transition-colors"
              >
                {n.label}
              </Link>
            ))}
          </div>
          {clerkEnabled && (
            <div className="ml-auto">
              <UserButton />
            </div>
          )}
        </div>
      </nav>
      {children}
    </div>
  );
}
