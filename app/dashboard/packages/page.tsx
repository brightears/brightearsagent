import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { deletePackage } from "@/app/actions/packages";
import { PackageForm } from "@/components/package-form";
import { Badge, Card, EmptyState, Kicker, PageHeader, StatPill, buttonStyles } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const business = await getCurrentBusiness();
  const packages = await db.package.findMany({
    where: { businessId: business.id },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  // Prices live in cents; display as whole dollars ($1,800–$2,200).
  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: business.currency,
    maximumFractionDigits: 0,
  });
  const priceLabel = (minCents: number, maxCents: number | null) =>
    maxCents !== null && maxCents !== minCents
      ? `${money.format(minCents / 100)}–${money.format(maxCents / 100)}`
      : money.format(minCents / 100);

  const activeCount = packages.filter((p) => p.active).length;
  const inactiveCount = packages.length - activeCount;

  return (
    <main className="flex-1 bg-ink-stage">
      <div className="mx-auto w-full max-w-7xl px-6 py-8">
      <PageHeader
        title="Packages"
        subtitle="Your rate card — these are the only prices the AI is allowed to quote."
        stats={
          packages.length > 0 ? (
            <>
              <StatPill tone="teal">
                {activeCount} active
              </StatPill>
              {inactiveCount > 0 && <StatPill>{inactiveCount} inactive</StatPill>}
            </>
          ) : undefined
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        <div className="grid gap-4 sm:grid-cols-2">
          {packages.map((pkg) => (
            <Card key={pkg.id} className={`p-6 ${pkg.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-bold text-ink-stage">{pkg.name}</h2>
                <Badge tone={pkg.active ? "cyan" : "gray"}>{pkg.active ? "Active" : "Inactive"}</Badge>
              </div>
              {/* Price hero — the show voice: magenta→orange gradient paint (v2). */}
              <p className="mt-2 text-3xl font-extrabold tracking-tight bg-gradient-to-r from-neon-magenta to-neon-orange bg-clip-text text-transparent">
                {priceLabel(pkg.priceMin, pkg.priceMax)}
              </p>
              {pkg.description && <p className="mt-2 text-sm text-ink-stage/65">{pkg.description}</p>}
              {pkg.eventTypes.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {pkg.eventTypes.map((type) => (
                    <Badge key={type} tone="lavender">
                      {type}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="mt-5 flex items-center gap-2 border-t border-cream pt-4">
                <PackageForm
                  initial={{
                    id: pkg.id,
                    name: pkg.name,
                    description: pkg.description,
                    priceMinDollars: pkg.priceMin / 100,
                    priceMaxDollars: pkg.priceMax === null ? null : pkg.priceMax / 100,
                    eventTypes: pkg.eventTypes,
                    active: pkg.active,
                  }}
                />
                <form
                  action={async () => {
                    "use server";
                    await deletePackage(pkg.id);
                  }}
                >
                  <button
                    type="submit"
                    className={`${pkg.active ? buttonStyles.danger : buttonStyles.secondaryOnLight} text-sm px-3 py-1.5`}
                  >
                    {pkg.active ? "Deactivate" : "Reactivate"}
                  </button>
                </form>
              </div>
            </Card>
          ))}
          {packages.length === 0 && (
            <Card className="sm:col-span-2 p-6">
              <EmptyState
                kicker="Your rate card"
                title="Add your first package."
                accent="package."
                hint="It's what the AI is allowed to quote — start with the form on the right."
              />
            </Card>
          )}
        </div>

        <Card className="overflow-hidden">
          <div className="bg-cream/60 px-6 py-4">
            <Kicker onLight>New package</Kicker>
            <h2 className="mt-1 text-xl font-black tracking-tight text-ink-stage">Add a package</h2>
            <p className="text-xs text-ink-stage/60 mt-0.5">Prices in dollars — we&apos;ll handle the cents.</p>
          </div>
          <div className="p-6">
            <PackageForm />
          </div>
        </Card>
      </div>
      </div>
    </main>
  );
}
