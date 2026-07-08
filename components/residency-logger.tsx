"use client";

// Residency logger on the CALENDAR page (founder preview catch): the
// onboarding step-4 logger wrote a whole recurring run at once, but an artist
// who lands a NEW residency after setup had to type every Wednesday by hand.
// Same addResidency action, same windowed-slot semantics (a 7-9pm time blocks
// only that window; blank = whole day).
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addResidency } from "@/app/actions/onboarding";
import { buttonStyles } from "@/components/ui";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const labelCls =
  "mb-1 block font-mono text-[11px] font-bold uppercase tracking-[0.14em] text-ink-stage/55";
const inputCls =
  "w-full rounded-xl border border-ink-stage/15 bg-white px-3 py-2 text-base sm:text-sm text-ink-stage focus:border-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/40";

export function ResidencyLogger() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [weekday, setWeekday] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [note, setNote] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const submit = () =>
    startTransition(async () => {
      setNote(null);
      if (weekday === null) {
        setNote({ kind: "error", text: "Pick which day of the week the residency runs." });
        return;
      }
      const result = await addResidency({ weekday, title, from, to, startTime, endTime });
      if (!result.ok) {
        setNote({ kind: "error", text: result.error });
        return;
      }
      setNote({
        kind: "success",
        text: `Locked in — ${result.added} ${WEEKDAYS[weekday]} night${result.added === 1 ? "" : "s"} on the books.`,
      });
      setTitle("");
      setFrom("");
      setTo("");
      setStartTime("");
      setEndTime("");
      setWeekday(null);
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-stage/60">
        Playing a regular weekly slot? Log it once — every night in the run lands on the calendar,
        so you&apos;re never shown as free when you&apos;re not.
      </p>
      <div>
        <span className={labelCls}>Which day?</span>
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((d, i) => (
            <button
              key={d}
              type="button"
              onClick={() => setWeekday(weekday === i ? null : i)}
              className={`rounded-full border-[1.5px] px-3 py-1 text-sm font-semibold transition-colors ${
                weekday === i
                  ? "border-brand-cyan bg-brand-cyan text-ink-stage"
                  : "border-ink-stage/20 text-ink-stage/70 hover:border-brand-cyan"
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label htmlFor="res-title" className={labelCls}>
          Venue / name
        </label>
        <input
          id="res-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Sing Sing (Wed residency)"
          className={inputCls}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="res-from" className={labelCls}>
            From
          </label>
          <input id="res-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="res-to" className={labelCls}>
            Until
          </label>
          <input id="res-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="res-start" className={labelCls}>
            Time (optional)
          </label>
          <input id="res-start" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className={inputCls} />
        </div>
        <div>
          <label htmlFor="res-end" className={labelCls}>
            Until
          </label>
          <input id="res-end" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputCls} />
        </div>
      </div>
      <p className="text-[11px] text-ink-stage/50">
        With a time (e.g. 7:00pm–9:00pm) only that window is blocked — a late gig elsewhere that
        night still counts you as free. Blank blocks the whole day.
      </p>
      {note && (
        <p
          className={`rounded-xl px-3 py-2 text-sm font-medium ${
            note.kind === "success" ? "bg-brand-cyan-soft text-ink-stage" : "bg-red-50 text-red-600"
          }`}
        >
          {note.text}
        </p>
      )}
      <button
        type="button"
        onClick={submit}
        disabled={isPending}
        className={`${buttonStyles.secondaryOnLight} w-full`}
      >
        {isPending ? "Adding…" : "Add residency nights"}
      </button>
    </div>
  );
}
