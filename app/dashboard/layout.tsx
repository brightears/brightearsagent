import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { BrightEarsLogo } from "@/components/ui";
import { DashboardNavLinks } from "@/components/dashboard-nav";

const NAV = [
  { href: "/dashboard", label: "Pipeline" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/packages", label: "Packages" },
  { href: "/dashboard/profile", label: "Profile" },
  { href: "/dashboard/settings", label: "Settings" },
];

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    // The app shell owns the ink canvas (docs/DESIGN.md v2): every dashboard
    // screen floats its white data cards on this stage.
    <div className="flex-1 flex flex-col bg-ink-stage text-cream-bright">
      <nav className="border-b border-cream/10 bg-ink-stage">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <BrightEarsLogo size={28} />
            <span className="font-black tracking-tight text-cream-bright">Bright Ears</span>
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
