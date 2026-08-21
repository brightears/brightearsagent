"use client";

import { useActionState, useMemo, useState } from "react";
import { updateBusiness } from "@/app/actions/settings";
import { isProvisionedBusinessName } from "@/lib/business-name";
import { buttonStyles } from "@/components/ui";
import { COUNTRIES } from "@/lib/geo/countries";
import { PerformerKind } from "@/app/generated/prisma/enums";
import { useI18n } from "@/components/locale-provider";

const PERFORMER_LABELS: Record<PerformerKind, string> = {
  DJ: "DJ",
  BAND: "Band",
  SINGER: "Singer",
  MAGICIAN: "Magician",
  DANCER: "Dancer",
  MC: "MC / Host",
  PHOTO_BOOTH: "Photo booth",
  MUSICIAN: "Musician",
  COMEDIAN: "Comedian",
  OTHER: "Other",
};

// Country list = the shared ISO-3166-1 source (lib/geo/countries.ts), already
// sorted and with sanctioned jurisdictions filtered out.

export type BusinessProfile = {
  name: string;
  ownerName: string;
  postalAddress: string | null;
  replyToEmail: string | null;
  timezone: string;
  country: string;
  websiteUrl: string | null;
  bookingLinkUrl: string | null;
  performerKind: PerformerKind;
};

// Form styling per docs/DESIGN.md v2 — cream-tinted inputs on white cards, cyan focus ring.
const inputCls =
  "w-full rounded-xl border border-cream bg-cream/40 px-3 py-2 text-base sm:text-sm text-ink-stage placeholder:text-ink-stage/35 focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 transition-colors";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-ink-stage/60 mb-1";

export function SettingsForm({ business }: { business: BusinessProfile }) {
  const { locale, t } = useI18n();
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: boolean; error?: string } | null, formData: FormData) =>
      updateBusiness(formData),
    null,
  );

  const timezones = useMemo(() => {
    const known =
      typeof Intl.supportedValuesOf === "function"
        ? Intl.supportedValuesOf("timeZone")
        : ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles"];
    return known.includes(business.timezone) ? known : [business.timezone, ...known];
  }, [business.timezone]);

  // Keep an already-saved country selectable even if it's not in the list
  // (e.g. a legacy/excluded code on an existing business) so saving never
  // silently changes it.
  const countries = COUNTRIES.some((c) => c.code === business.country)
    ? COUNTRIES
    : [{ code: business.country, name: business.country }, ...COUNTRIES];
  const countryNames = useMemo(
    () => new Intl.DisplayNames([locale === "th" ? "th-TH" : "en"], { type: "region" }),
    [locale],
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className={labelCls}>
            {t("onboarding.business.stageName")}
          </label>
          <input
            id="name"
            name="name"
            required
            // The provisioning default ("Norbert's Business") is not a stage
            // name — show it as an empty required field so the artist types
            // their real one before it fronts a client-facing email.
            defaultValue={isProvisionedBusinessName(business) ? "" : business.name}
            placeholder="DJ Midnight (or Midnight Groove)"
            className={inputCls}
          />
          <p className="mt-1 text-xs text-ink-stage/50">
            {t("settings.identity.nameHint")}
          </p>
        </div>
        <div>
          <label htmlFor="ownerName" className={labelCls}>
            {t("onboarding.business.yourName")}
          </label>
          <input
            id="ownerName"
            name="ownerName"
            required
            defaultValue={business.ownerName}
            className={inputCls}
          />
        </div>
        <div>
          <label htmlFor="performerKind" className={labelCls}>
            {t("onboarding.business.performerKind")}
          </label>
          <select
            id="performerKind"
            name="performerKind"
            defaultValue={business.performerKind}
            className={inputCls}
          >
            {Object.values(PerformerKind).map((kind) => (
              <option key={kind} value={kind}>
                {locale === "th"
                  ? ({
                      DJ: "DJ",
                      BAND: "วงดนตรี",
                      SINGER: "นักร้อง",
                      MAGICIAN: "นักมายากล",
                      DANCER: "นักเต้น",
                      MC: "พิธีกร / MC",
                      PHOTO_BOOTH: "โฟโต้บูธ",
                      MUSICIAN: "นักดนตรี",
                      COMEDIAN: "นักแสดงตลก",
                      OTHER: "อื่น ๆ",
                    } as Record<PerformerKind, string>)[kind]
                  : PERFORMER_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="replyToEmail" className={labelCls}>
            {t("settings.identity.replyEmail")}
          </label>
          <input
            id="replyToEmail"
            name="replyToEmail"
            type="email"
            placeholder={t("settings.identity.replyPlaceholder")}
            defaultValue={business.replyToEmail ?? ""}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-ink-stage/50">{t("settings.identity.replyHint")}</p>
        </div>
        <div>
          <label htmlFor="timezone" className={labelCls}>
            {t("onboarding.business.timezone")}
          </label>
          <select id="timezone" name="timezone" defaultValue={business.timezone} className={inputCls}>
            {timezones.map((tz) => (
              <option key={tz} value={tz}>
                {tz.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="country" className={labelCls}>
            {t("onboarding.business.country")}
          </label>
          <select id="country" name="country" defaultValue={business.country} className={inputCls}>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {countryNames.of(c.code) ?? c.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-stage/50">{t("settings.identity.countryHint")}</p>
        </div>
        <div id="business-mailing-address" className="scroll-mt-24 sm:col-span-2">
          <label htmlFor="postalAddress" className={labelCls}>
            {t("onboarding.business.address")}
          </label>
          <textarea
            id="postalAddress"
            name="postalAddress"
            required
            rows={2}
            autoComplete="street-address"
            placeholder="Street, city, region, postal code, country"
            defaultValue={business.postalAddress ?? ""}
            className={`${inputCls} resize-y`}
          />
          <p className="mt-1 text-xs text-ink-stage/50">
            {t("settings.identity.addressHint")}
          </p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="websiteUrl" className={labelCls}>
            {t("settings.identity.website")}
          </label>
          <input
            id="websiteUrl"
            name="websiteUrl"
            type="url"
            placeholder="https://yourdjsite.com"
            defaultValue={business.websiteUrl ?? ""}
            className={inputCls}
          />
        </div>

        <div className="sm:col-span-2">
          <label htmlFor="bookingLinkUrl" className={labelCls}>
            {t("settings.identity.booking")}
          </label>
          <input
            id="bookingLinkUrl"
            name="bookingLinkUrl"
            type="url"
            placeholder="Your Check Cherry, HoneyBook or Stripe payment page"
            defaultValue={business.bookingLinkUrl ?? ""}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-ink-stage/45">
            {t("settings.identity.bookingHint")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonStyles.primary}>
          {pending ? t("common.saving") : t("settings.saveChanges")}
        </button>
        {state?.ok && (
          <span className="rounded-full bg-brand-cyan-soft px-3 py-1 text-sm font-semibold text-ink-stage">
            {t("settings.saved")}
          </span>
        )}
        {state && !state.ok && (
          <span className="text-sm font-medium text-red-600">{state.error}</span>
        )}
      </div>
    </form>
  );
}

/** Small clipboard button — used by the lead-address card on the settings page. */
export function CopyButton({ text }: { text: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      // Lives inside white/cream panels — ink-outline ghost (cream outline is invisible there).
      className={buttonStyles.secondaryOnLight}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // Clipboard unavailable (http / old browser) — leave the address selectable.
        }
      }}
    >
      {copied ? t("settings.copied") : t("settings.copy")}
    </button>
  );
}
