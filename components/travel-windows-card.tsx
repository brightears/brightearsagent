"use client";

// "Where you hunt" Control Room section (Travel Mode). Two parts on one card:
//   1. Home Base — the artist's serviceCities (the cities the Hunt scans) +
//      an advisory radius, BOTH editable here via updateHomeBase. This is the
//      single source of truth for the cities — they used to be edited on the
//      profile, which split them from where they're actually used.
//   2. Travel Windows — add a window (city, country, dates, optional radius,
//      role tags) and cancel/remove existing ones. When a window is live the
//      Hunt ALSO scans that city for those dates and drafts date-bounded
//      outreach.
// On-brand per docs/DESIGN.md v2.1: cream-tinted inputs on white card, cyan
// focus ring, mono Kickers, NO emoji ever.

import { useActionState } from "react";
import { buttonStyles } from "@/components/ui";
import {
  addTravelWindow,
  cancelTravelWindowForm,
  updateHomeBase,
} from "@/app/actions/travel";
import { COUNTRIES } from "@/lib/geo/countries";
import { TRAVEL_ROLE_TAGS, type TravelRoleTag } from "@/lib/travel/roles";

const inputCls =
  "w-full rounded-xl border border-cream bg-cream/40 px-3 py-2 text-base sm:text-sm text-ink-stage placeholder:text-ink-stage/35 focus:outline-none focus:border-brand-cyan focus:ring-2 focus:ring-brand-cyan/30 transition-colors";
const labelCls = "block text-xs font-semibold uppercase tracking-wide text-ink-stage/60 mb-1";

// Country list = the shared ISO-3166-1 source (lib/geo/countries.ts), already
// sorted and with sanctioned jurisdictions filtered out.

const ROLE_LABELS: Record<TravelRoleTag, string> = {
  "guest-spot": "Guest spot",
  residency: "Residency",
  "private-event": "Private event",
};

export type TravelWindowRow = {
  id: string;
  city: string;
  country: string;
  startDate: string; // YYYY-MM-DD (UTC)
  endDate: string; // YYYY-MM-DD (UTC)
  radiusKm: number | null;
  roleTags: string[];
  status: "ACTIVE" | "CANCELLED" | "EXPIRED";
};

function fmtRange(start: string, end: string): string {
  const f = (iso: string) => {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  };
  return start === end ? f(start) : `${f(start)} – ${f(end)}`;
}

function HomeBaseForm({
  serviceCities,
  homeRadiusKm,
  homeCityCap,
}: {
  serviceCities: string[];
  homeRadiusKm: number | null;
  /** How many home cities this plan's Hunt scans (coverage gate). */
  homeCityCap: number;
}) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: boolean; error?: string; notice?: string } | null, formData: FormData) =>
      updateHomeBase(formData),
    null,
  );
  return (
    <form action={formAction}>
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink-stage/50">
        Home base
      </p>
      <div className="mt-3 space-y-4">
        <div>
          <label htmlFor="serviceCities" className={labelCls}>
            Cities you&apos;re based in
          </label>
          <input
            id="serviceCities"
            name="serviceCities"
            placeholder="Austin, San Antonio, Hill Country"
            defaultValue={serviceCities.join(", ")}
            className={inputCls}
          />
          <p className="mt-1.5 text-xs text-ink-stage/45">
            Comma-separated. The agent only hunts where you play — this is where it starts. Your plan
            covers{" "}
            <span className="font-semibold text-ink-stage/65">
              {homeCityCap === 1 ? "1 city" : `${homeCityCap} cities`}
            </span>
            {homeCityCap < 25 && " — upgrade to hunt more"}.
          </p>
        </div>
        <div className="w-40">
          <label htmlFor="homeRadiusKm" className={labelCls}>
            Travel radius (km)
          </label>
          <input
            id="homeRadiusKm"
            name="homeRadiusKm"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="Optional"
            defaultValue={homeRadiusKm ?? ""}
            className={inputCls}
          />
          <p className="mt-1.5 text-xs text-ink-stage/45">
            Advisory for now — how far from home you&apos;ll travel for a gig.
          </p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonStyles.primary}>
          {pending ? "Saving…" : "Save home base"}
        </button>
        {state?.ok && (
          <span className="text-sm font-semibold text-ink-stage/70">
            {state.notice ?? "Saved"}
          </span>
        )}
        {state && !state.ok && <span className="text-sm font-medium text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

function AddWindowForm() {
  const [state, formAction, pending] = useActionState(
    async (_prev: { ok: boolean; error?: string } | null, formData: FormData) => {
      const res = await addTravelWindow(formData);
      return res;
    },
    null,
  );
  return (
    <form action={formAction} className="space-y-4 rounded-2xl bg-cream/40 p-4">
      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink-stage/50">
        Add a travel window
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="tw-city" className={labelCls}>
            City
          </label>
          <input id="tw-city" name="city" required placeholder="Lisbon" className={inputCls} />
        </div>
        <div>
          <label htmlFor="tw-country" className={labelCls}>
            Country
          </label>
          <select id="tw-country" name="country" required defaultValue="" className={inputCls}>
            <option value="" disabled>
              Pick a country
            </option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="tw-start" className={labelCls}>
            From
          </label>
          <input id="tw-start" name="startDate" type="date" required className={inputCls} />
        </div>
        <div>
          <label htmlFor="tw-end" className={labelCls}>
            To
          </label>
          <input id="tw-end" name="endDate" type="date" required className={inputCls} />
        </div>
        <div>
          <label htmlFor="tw-radius" className={labelCls}>
            Radius (km)
          </label>
          <input
            id="tw-radius"
            name="radiusKm"
            type="number"
            min={1}
            inputMode="numeric"
            placeholder="Optional"
            className={inputCls}
          />
        </div>
        <div>
          <span className={labelCls}>What to hunt</span>
          <div className="flex flex-wrap gap-3 pt-1">
            {TRAVEL_ROLE_TAGS.map((tag) => (
              <label key={tag} className="inline-flex items-center gap-1.5 text-sm text-ink-stage/80">
                <input
                  type="checkbox"
                  name="roleTags"
                  value={tag}
                  className="size-4 rounded border-cream text-brand-cyan focus:ring-brand-cyan/30"
                />
                {ROLE_LABELS[tag]}
              </label>
            ))}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={buttonStyles.primary}>
          {pending ? "Adding…" : "Add window"}
        </button>
        {state?.ok && <span className="text-sm font-semibold text-ink-stage/70">Added</span>}
        {state && !state.ok && <span className="text-sm font-medium text-red-600">{state.error}</span>}
      </div>
    </form>
  );
}

export function TravelWindowsCard({
  serviceCities,
  homeRadiusKm,
  homeCityCap,
  windows,
}: {
  serviceCities: string[];
  homeRadiusKm: number | null;
  /** Coverage gate: how many home cities this plan's Hunt scans. */
  homeCityCap: number;
  /** ACTIVE + upcoming/live windows (the page filters out cancelled/expired). */
  windows: TravelWindowRow[];
}) {
  // With no home cities AND no travel windows the agent has nowhere to scan —
  // the discovery cron skips the tenant entirely. Surface that plainly rather
  // than letting a cleared cities field silently switch the Hunt off.
  const nowhereToHunt = serviceCities.length === 0 && windows.length === 0;
  return (
    <div className="rounded-3xl border border-cream/10 bg-white p-6 shadow-[0_16px_40px_rgba(0,0,0,0.08)]">
      {nowhereToHunt && (
        <p className="mb-5 rounded-xl bg-[#ffdfba] px-3 py-2 text-sm text-ink-stage/80">
          <span className="font-semibold text-[#7a4100]">The agent has nowhere to hunt yet</span> —
          add a home city below, or a travel window, so it knows where to look.
        </p>
      )}
      <HomeBaseForm
        serviceCities={serviceCities}
        homeRadiusKm={homeRadiusKm}
        homeCityCap={homeCityCap}
      />

      <div className="my-6 border-t border-ink-stage/10" />

      <p className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-ink-stage/50">
        Travel windows
      </p>
      {windows.length === 0 ? (
        <p className="mt-2 mb-4 text-sm text-ink-stage/55">
          No travel windows yet. Add one below — when you&apos;re away, the agent looks for work in
          that city for those dates.
        </p>
      ) : (
        <ul className="mb-5 mt-3 space-y-2">
          {windows.map((w) => (
            <li
              key={w.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-stage/10 bg-white p-3 shadow-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-ink-stage">
                  {w.city}, {w.country}
                </p>
                <p className="mt-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/45">
                  {fmtRange(w.startDate, w.endDate)}
                  {w.roleTags.length > 0 &&
                    ` · ${w.roleTags.map((t) => ROLE_LABELS[t as TravelRoleTag] ?? t).join(", ")}`}
                  {w.radiusKm ? ` · ${w.radiusKm} km` : ""}
                </p>
              </div>
              <form action={cancelTravelWindowForm.bind(null, w.id)}>
                <button type="submit" className={`${buttonStyles.secondaryOnLight} text-sm`}>
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <AddWindowForm />
    </div>
  );
}
