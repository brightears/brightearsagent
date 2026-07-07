"use client";

import { useActionState, useMemo, useState } from "react";
import { updateBusiness } from "@/app/actions/settings";
import { isProvisionedBusinessName } from "@/lib/business-name";
import { buttonStyles } from "@/components/ui";
import { COUNTRIES } from "@/lib/geo/countries";
import { PerformerKind } from "@/app/generated/prisma/enums";

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
  replyToEmail: string | null;
  timezone: string;
  country: string;
  websiteUrl: string | null;
  bookingLinkUrl: string | null;
  performerKind: PerformerKind;
};

// Form styling per docs/DESIGN.md v2 — cream-tinted inputs on white cards, cyan focus ring.
const inputCls =
  "w-full rounded-xl border border-cream bg-cream/40 px-3 py-2 text-sm text-ink-stage placeholder:text-ink-stage/35 focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 transition-colors";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-ink-stage/60 mb-1";

export function SettingsForm({ business }: { business: BusinessProfile }) {
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

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="name" className={labelCls}>
            Stage / artist name
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
            The name clients and venues see — on every reply, your press kit, and every pitch.
          </p>
        </div>
        <div>
          <label htmlFor="ownerName" className={labelCls}>
            Your name
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
            What do you perform?
          </label>
          <select
            id="performerKind"
            name="performerKind"
            defaultValue={business.performerKind}
            className={inputCls}
          >
            {Object.values(PerformerKind).map((kind) => (
              <option key={kind} value={kind}>
                {PERFORMER_LABELS[kind]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="replyToEmail" className={labelCls}>
            Reply-to email
          </label>
          <input
            id="replyToEmail"
            name="replyToEmail"
            type="email"
            placeholder="Defaults to your login email"
            defaultValue={business.replyToEmail ?? ""}
            className={inputCls}
          />
          <p className="mt-1 text-xs text-ink-stage/50">When a client hits reply, it lands here.</p>
        </div>
        <div>
          <label htmlFor="timezone" className={labelCls}>
            Timezone
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
            Country
          </label>
          <select id="country" name="country" defaultValue={business.country} className={inputCls}>
            {countries.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-stage/50">Sets the right email compliance footer for you.</p>
        </div>
        <div className="sm:col-span-2">
          <label htmlFor="websiteUrl" className={labelCls}>
            Website
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
            Booking / deposit link
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
            When a couple is ready, the AI includes this link so they can lock in their date — your existing booking page, contract, or deposit link.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonStyles.primary}>
          {pending ? "Saving…" : "Save changes"}
        </button>
        {state?.ok && (
          <span className="rounded-full bg-brand-cyan-soft px-3 py-1 text-sm font-semibold text-ink-stage">
            Saved ✓
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
      {copied ? "Copied ✓" : "Copy"}
    </button>
  );
}
