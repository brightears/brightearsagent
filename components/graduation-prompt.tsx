import { declineAutoSendGraduation, updateAutoSendSources } from "@/app/actions/settings";
import { Kicker } from "@/components/ui";
import type { LeadSource } from "@/app/generated/prisma/enums";

const SOURCE_PHRASE: Partial<Record<LeadSource, string>> = {
  WEBSITE_FORM: "website-form",
  PLAIN_EMAIL: "email",
  THE_KNOT: "The Knot",
  WEDDINGWIRE: "WeddingWire",
  BARK: "Bark",
  THUMBTACK: "Thumbtack",
  VENUE_OUTREACH: "venue-reply",
  OTHER: "other-source",
};

/**
 * Autonomy graduation prompt (P10.3): shown in the queue once the owner has
 * approved GRADUATION_THRESHOLD drafts from one source without touching a
 * word — the evidence that reviewing adds nothing for that source. Autonomy
 * is offered on evidence, never silently expanded (never-do guardrail #8).
 *
 * "Yes" posts THROUGH updateAutoSendSources — the Control Room section's one
 * writer — with the full trusted list as hidden inputs (existing + this
 * source), so there is exactly one code path that ever writes autonomy.
 * "Keep reviewing" is remembered server-side; the ask never nags twice.
 */
export function GraduationPrompt({
  source,
  count,
  trusted,
}: {
  source: LeadSource;
  count: number;
  trusted: LeadSource[];
}) {
  const phrase = SOURCE_PHRASE[source] ?? "these";
  return (
    <section className="mb-6 rounded-2xl border border-brand-cyan/40 bg-ink-raised px-5 py-4">
      <Kicker>Earned autonomy</Kicker>
      <p className="mt-1.5 text-sm text-cream/85">
        <span className="font-bold text-cream-bright">
          You approved {count} {phrase} replies without changing a word.
        </span>{" "}
        Want the agent to send these on its own? Same drafts, same voice, real availability — it
        just stops waiting for your tap. Every send still shows up here, and you can switch it off
        any time in the Control room.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <form
          action={async (formData: FormData) => {
            "use server";
            await updateAutoSendSources(formData);
          }}
        >
          {[...new Set([...trusted, source])].map((s) => (
            <input key={s} type="hidden" name="autoSendSources" value={s} />
          ))}
          <button
            type="submit"
            className="rounded-full bg-brand-cyan px-5 py-2 text-sm font-bold text-ink-stage transition-opacity hover:opacity-90"
          >
            Yes — auto-send these
          </button>
        </form>
        <form
          action={async () => {
            "use server";
            await declineAutoSendGraduation(source);
          }}
        >
          <button
            type="submit"
            className="text-sm font-semibold text-cream/45 transition-colors hover:text-cream/70"
          >
            Keep reviewing
          </button>
        </form>
      </div>
    </section>
  );
}
