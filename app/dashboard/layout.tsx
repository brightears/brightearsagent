import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { BrightEarsLogo } from "@/components/ui";
import { DashboardNavLinks } from "@/components/dashboard-nav";

const NAV = [
  { href: "/dashboard", label: "Pipeline" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/packages", label: "Packages" },
  // Profile + Settings collapsed into one Control Room (Phase 2b); the old
  // /dashboard/profile route redirects to /dashboard/settings#profile.
  { href: "/dashboard/settings", label: "Control room" },
];

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    // The app shell owns the ink canvas (docs/DESIGN.md v2): every dashboard
    // screen floats its white data cards on this stage.
    <div className="flex-1 flex flex-col bg-ink-stage text-cream-bright">
      <nav className="border-b border-cream/10 bg-ink-stage">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3 sm:gap-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <BrightEarsLogo size={28} />
            <span className="font-black tracking-tight text-cream-bright">Bright Ears</span>
          </Link>
          {/* min-w-0 + overflow-x-auto lets the nav scroll on phones so all five
              sections stay reachable and the UserButton never gets pushed off
              the viewport (audit C5). */}
          <div className="min-w-0 flex-1 overflow-x-auto">
            <DashboardNavLinks links={NAV} />
          </div>
          {clerkEnabled && (
            <div className="shrink-0">
              <UserButton />
            </div>
          )}
        </div>
      </nav>
      {children}
    </div>
  );
}
