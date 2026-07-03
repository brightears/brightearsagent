import { describe, it, expect } from "vitest";
import { residencyDates, MAX_RESIDENCY_DATES } from "@/lib/calendar/residency";

const dow = (iso: string) => new Date(`${iso}T12:00:00Z`).getUTCDay();

describe("residencyDates", () => {
  it("returns every matching weekday in range, all on that weekday, 7 days apart", () => {
    const out = residencyDates(3, "2026-07-01", "2026-07-31"); // Wednesdays in July
    expect(out.length).toBeGreaterThan(3);
    expect(out.every((d) => dow(d) === 3)).toBe(true);
    for (let i = 1; i < out.length; i++) {
      const diff = (Date.parse(out[i]) - Date.parse(out[i - 1])) / 86_400_000;
      expect(diff).toBe(7);
    }
  });

  it("is inclusive and stays within the range", () => {
    const out = residencyDates(3, "2026-07-01", "2026-07-31");
    expect(Date.parse(out[0]) >= Date.parse("2026-07-01")).toBe(true);
    expect(Date.parse(out[out.length - 1]) <= Date.parse("2026-07-31")).toBe(true);
  });

  it("is empty for from > to, an invalid weekday, or a bad date", () => {
    expect(residencyDates(3, "2026-07-31", "2026-07-01")).toEqual([]);
    expect(residencyDates(9, "2026-07-01", "2026-07-31")).toEqual([]);
    expect(residencyDates(3, "not-a-date", "2026-07-31")).toEqual([]);
  });

  it("caps a huge range at MAX_RESIDENCY_DATES", () => {
    expect(residencyDates(1, "2026-01-01", "2030-01-01").length).toBe(MAX_RESIDENCY_DATES);
  });
});
