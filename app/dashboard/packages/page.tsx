import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { deletePackage } from "@/app/actions/packages";
import { PackageForm } from "@/components/package-form";
import { Badge, Card, buttonStyles } from "@/components/ui";

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

  return (
    <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full">
      <header className="mb-6">
        <h1 className="text-2xl font-bold text-deep-teal">Packages</h1>
        <p className="text-sm text-ink/60">
          Your rate card — these are the only prices the AI is allowed to quote.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px] items-start">
        <div className="grid gap-4 sm:grid-cols-2">
          {packages.map((pkg) => (
            <Card key={pkg.id} className={`p-5 ${pkg.active ? "" : "opacity-60"}`}>
              <div className="flex items-start justify-between gap-2 mb-1">
                <h2 className="font-bold text-deep-teal">{pkg.name}</h2>
                <Badge tone={pkg.active ? "cyan" : "gray"}>{pkg.active ? "Active" : "Inactive"}</Badge>
              </div>
              <p className="text-2xl font-bold text-ink mb-2">
                {priceLabel(pkg.priceMin, pkg.priceMax)}
              </p>
              {pkg.description && <p className="text-sm text-ink/70 mb-3">{pkg.description}</p>}
              {pkg.eventTypes.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {pkg.eventTypes.map((type) => (
                    <Badge key={type} tone="lavender">
                      {type}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2 pt-3 border-t border-off-white">
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
                    className={`${pkg.active ? buttonStyles.danger : buttonStyles.secondary} text-sm px-3 py-1.5`}
                  >
                    {pkg.active ? "Deactivate" : "Reactivate"}
                  </button>
                </form>
              </div>
            </Card>
          ))}
          {packages.length === 0 && (
            <Card className="p-8 sm:col-span-2 text-center">
              <p className="text-ink/50">
                No packages yet — add your first one and the AI can start quoting it. →
              </p>
            </Card>
          )}
        </div>

        <Card className="p-5">
          <h2 className="text-lg font-bold text-deep-teal mb-1">Add a package</h2>
          <p className="text-xs text-ink/60 mb-4">Prices in dollars — we&apos;ll handle the cents.</p>
          <PackageForm />
        </Card>
      </div>
    </main>
  );
}
