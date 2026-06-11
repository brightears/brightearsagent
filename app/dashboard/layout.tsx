import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { BrightEarsLogo } from "@/components/ui";
import { DashboardNavLinks } from "@/components/dashboard-nav";

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
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            <BrightEarsLogo size={28} />
            <span className="font-bold text-deep-teal">Bright Ears</span>
          </Link>
          <DashboardNavLinks links={NAV} />
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
