import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { deletePackage } from "@/app/actions/packages";
import { PackageForm } from "@/components/package-form";
import { Badge, Card, EmptyState, Kicker, PageHeader, StatPill, buttonStyles } from "@/components/ui";
import { getTranslations } from "@/lib/i18n/server";
import { languageTag } from "@/lib/i18n/config";

export const dynamic = "force-dynamic";

export default async function PackagesPage() {
  const { locale } = await getTranslations();
  const c = (english: string, thai: string) => locale === "th" ? thai : english;
  const business = await getCurrentBusiness();
  const packages = await db.package.findMany({
    where: { businessId: business.id },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  // Prices live in cents; display as whole dollars ($1,800–$2,200).
  const money = new Intl.NumberFormat(languageTag(locale), {
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
        title={c("Packages", "แพ็กเกจ")}
        subtitle={c("Your rate card — these are the only prices your assistant is allowed to quote.", "รายการราคาของคุณ ผู้ช่วยจะเสนอได้เฉพาะราคาที่คุณกำหนดไว้ที่นี่")}
        stats={
          packages.length > 0 ? (
            <>
              <StatPill tone="teal">
                {locale === "th" ? `เปิดใช้ ${activeCount}` : `${activeCount} active`}
              </StatPill>
              {inactiveCount > 0 && <StatPill>{locale === "th" ? `ปิดใช้ ${inactiveCount}` : `${inactiveCount} inactive`}</StatPill>}
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
                <Badge tone={pkg.active ? "cyan" : "gray"}>{pkg.active ? c("Active", "เปิดใช้") : c("Inactive", "ปิดใช้")}</Badge>
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
                  currency={business.currency}
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
                    {pkg.active ? c("Deactivate", "ปิดใช้งาน") : c("Reactivate", "เปิดใช้อีกครั้ง")}
                  </button>
                </form>
              </div>
            </Card>
          ))}
          {packages.length === 0 && (
            <Card className="sm:col-span-2 p-6">
              <EmptyState
                kicker={c("Your rate card", "รายการราคาของคุณ")}
                title={c("Add your first package.", "เพิ่มแพ็กเกจแรกของคุณ")}
                accent={c("package.", "แพ็กเกจแรก")}
                hint={c("It's what your assistant is allowed to quote — start with the form on the right.", "ผู้ช่วยจะเสนอราคาได้จากแพ็กเกจเหล่านี้ เริ่มจากแบบฟอร์มด้านขวา")}
              />
            </Card>
          )}
        </div>

        <Card className="overflow-hidden">
          <div className="bg-cream/60 px-6 py-4">
            <Kicker onLight>{c("New package", "แพ็กเกจใหม่")}</Kicker>
            <h2 className="mt-1 text-xl font-black tracking-tight text-ink-stage">{c("Add a package", "เพิ่มแพ็กเกจ")}</h2>
            <p className="text-xs text-ink-stage/60 mt-0.5">{c(`Whole ${business.currency} — we'll handle the rest.`, `กรอกจำนวนเต็มหน่วย ${business.currency} ที่เหลือเราจัดการให้`)}</p>
          </div>
          <div className="p-6">
            <PackageForm currency={business.currency} />
          </div>
        </Card>
      </div>
      </div>
    </main>
  );
}
