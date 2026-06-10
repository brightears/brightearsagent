"use client";

import { useActionState } from "react";
import { createGig } from "@/app/actions/gigs";
import { buttonStyles } from "@/components/ui";

type ActionResult = { ok: boolean; error?: string } | null;

const inputStyles =
  "w-full rounded-xl border border-off-white bg-white px-3 py-2 text-sm text-ink placeholder:text-ink/30 focus:outline-none focus:border-brand-cyan transition-colors";
const labelStyles = "block text-xs font-semibold text-deep-teal mb-1";

export function GigForm({ performers }: { performers: { id: string; name: string }[] }) {
  const [result, formAction, pending] = useActionState<ActionResult, FormData>(
    (_prev, formData) => createGig(formData),
    null,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor="gig-date" className={labelStyles}>Date</label>
        <input id="gig-date" name="date" type="date" required className={inputStyles} />
      </div>

      <div>
        <label htmlFor="gig-title" className={labelStyles}>Title</label>
        <input
          id="gig-title"
          name="title"
          type="text"
          required
          placeholder="Nguyen wedding"
          className={inputStyles}
        />
      </div>

      <div>
        <label htmlFor="gig-venue" className={labelStyles}>Venue (optional)</label>
        <input
          id="gig-venue"
          name="venue"
          type="text"
          placeholder="Lakeside Manor"
          className={inputStyles}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="gig-start" className={labelStyles}>Start</label>
          <input id="gig-start" name="startTime" type="time" className={inputStyles} />
        </div>
        <div>
          <label htmlFor="gig-end" className={labelStyles}>End</label>
          <input id="gig-end" name="endTime" type="time" className={inputStyles} />
        </div>
      </div>

      <div>
        <label htmlFor="gig-performer" className={labelStyles}>Performer</label>
        <select id="gig-performer" name="performerId" defaultValue="" className={inputStyles}>
          <option value="">Whole business (unassigned)</option>
          {performers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <button type="submit" disabled={pending} className={`${buttonStyles.primary} w-full`}>
        {pending ? "Adding…" : "Add gig"}
      </button>

      {result && !result.ok && <p className="text-xs text-red-600">{result.error}</p>}
      {result?.ok && <p className="text-xs font-medium text-deep-teal">Gig added 🎉</p>}
    </form>
  );
}
