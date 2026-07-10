import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { BrightEarsLogo } from "@/components/ui";
import { DashboardNavLinks } from "@/components/dashboard-nav";
import { BottomTabs } from "@/components/bottom-tabs";

const NAV = [
  { href: "/dashboard", label: "Pipeline" },
  { href: "/dashboard/results", label: "Results" },
  { href: "/dashboard/calendar", label: "Calendar" },
  { href: "/dashboard/packages", label: "Packages" },
  // Profile + Settings collapsed into one Control Room (Phase 2b); the old
  // /dashboard/profile route redirects to /dashboard/settings#profile.
  { href: "/dashboard/settings", label: "Control room" },
];

const clerkEnabled = !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Badge for the Today tab (P9.3): everything waiting on the artist's tap.
  // Best-effort — a shell must render even if tenant resolution hiccups.
  let pendingCount = 0;
  try {
    const business = await getCurrentBusiness();
    const [drafts, pitches] = await Promise.all([
      db.draft.count({ where: { status: "PENDING", lead: { businessId: business.id } } }),
      db.venuePitch.count({ where: { status: "PENDING", businessId: business.id } }),
    ]);
    pendingCount = drafts + pitches;
  } catch {
    // Signed-out / provisioning edge — the proxy handles auth; badge stays 0.
  }

  return (
    // The app shell owns the ink canvas (docs/DESIGN.md v2): every dashboard
    // screen floats its white data cards on this stage. pb clears the fixed
    // bottom tab bar on phones (P9.3); lg+ has no bar.
    <div className="flex-1 flex flex-col bg-ink-stage text-cream-bright pb-14 lg:pb-0">
      <nav className="border-b border-cream/10 bg-ink-stage">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3 sm:gap-6">
          <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
            <BrightEarsLogo size={28} />
            <span className="font-black tracking-tight text-cream-bright">Bright Ears</span>
          </Link>
          {/* lg+: the classic top link row. Below lg the BottomTabs own section
              navigation (P9.3 — the scroll-row hid 3 of 5 sections), so the top
              bar keeps just brand + account. */}
          <div className="min-w-0 flex-1 overflow-x-auto max-lg:hidden">
            <DashboardNavLinks links={NAV} />
          </div>
          <div className="min-w-0 flex-1 lg:hidden" />
          {clerkEnabled && (
            <div className="shrink-0">
              <UserButton />
            </div>
          )}
        </div>
      </nav>
      {children}
      <BottomTabs pendingCount={pendingCount} />
    </div>
  );
}
