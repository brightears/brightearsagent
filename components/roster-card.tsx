import { addPerformer, setPerformerActive, updatePerformer } from "@/app/actions/performers";
import { Card, Kicker, buttonStyles } from "@/components/ui";
import type { Performer, PerformerKind } from "@/app/generated/prisma/client";

// Roster (P13.1) — Studio's multi-performer claim, restored honestly. Server
// component: plain forms bound to tenant-scoped actions; the plan's
// rosterCap renders as honest signage AND is re-enforced at save.

const KIND_OPTIONS: { value: PerformerKind; label: string }[] = [
  { value: "DJ", label: "DJ" },
  { value: "BAND", label: "Band" },
  { value: "SINGER", label: "Singer" },
  { value: "MUSICIAN", label: "Musician" },
  { value: "MAGICIAN", label: "Magician" },
  { value: "DANCER", label: "Dancer" },
  { value: "MC", label: "MC / host" },
  { value: "COMEDIAN", label: "Comedian" },
  { value: "PHOTO_BOOTH", label: "Photo booth" },
  { value: "OTHER", label: "Other" },
];

const inputCls =
  "rounded-xl border border-ink-stage/15 bg-white px-3 py-2 text-base sm:text-sm text-ink-stage focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/40";

export function RosterCard({
  performers,
  rosterCap,
}: {
  performers: Performer[];
  rosterCap: number;
}) {
  const active = performers.filter((p) => p.active);
  const inactive = performers.filter((p) => !p.active);
  const capReached = active.length >= rosterCap;

  return (
    <Card className="p-6">
      <h3 className="mb-1">
        <Kicker onLight>Roster</Kicker>
      </h3>
      <p className="mb-4 text-sm text-ink-stage/60">
        Who performs under this act. Gigs tag a performer, and availability is checked per
        performer — {rosterCap === 1
          ? "your plan covers one performer; Studio adds the roster."
          : `your plan covers up to ${rosterCap} active performers.`}
      </p>

      {performers.length > 0 && (
        <ul className="mb-5 space-y-3">
          {[...active, ...inactive].map((p) => (
            <li key={p.id} className={p.active ? "" : "opacity-55"}>
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await updatePerformer(p.id, formData);
                }}
                className="flex flex-wrap items-center gap-2.5"
              >
                <input
                  name="name"
                  defaultValue={p.name}
                  maxLength={80}
                  required
                  aria-label="Performer name"
                  className={`${inputCls} w-44`}
                />
                <select name="kind" defaultValue={p.kind} aria-label="Performer kind" className={inputCls}>
                  {KIND_OPTIONS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <button type="submit" className={`${buttonStyles.secondaryOnLight} px-3.5 py-1.5 text-sm`}>
                  Save
                </button>
                <button
                  type="submit"
                  formAction={async () => {
                    "use server";
                    await setPerformerActive(p.id, !p.active);
                  }}
                  className="text-sm font-semibold text-ink-stage/45 transition-colors hover:text-ink-stage/70"
                >
                  {p.active ? "Deactivate" : "Reactivate"}
                </button>
                {!p.active && (
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/40">
                    Inactive — history kept
                  </span>
                )}
              </form>
            </li>
          ))}
        </ul>
      )}

      {capReached ? (
        rosterCap === 1 && (
          <p className="text-xs text-ink-stage/55">
            Running more than one performer?{" "}
            <a href="#billing" className="font-semibold text-brand-cyan hover:opacity-80">
              Studio
            </a>{" "}
            routes inquiries across a roster.
          </p>
        )
      ) : (
        <form
          action={async (formData: FormData) => {
            "use server";
            await addPerformer(formData);
          }}
          className="flex flex-wrap items-center gap-2.5 border-t border-ink-stage/10 pt-4"
        >
          <input
            name="name"
            placeholder="Performer name"
            maxLength={80}
            required
            aria-label="New performer name"
            className={`${inputCls} w-44`}
          />
          <select name="kind" aria-label="New performer kind" className={inputCls}>
            {KIND_OPTIONS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
          <button type="submit" className={`${buttonStyles.primary} px-4 py-2 text-sm`}>
            Add performer
          </button>
        </form>
      )}
    </Card>
  );
}
