import { describe, expect, it } from "vitest";
import {
  assessParseQuality,
  type ParseEvalField,
  type ParseEvalTally,
} from "@/evals/parse-quality";

const fields: ParseEvalField[] = [
  "isInquiry",
  "eventType",
  "eventDate",
  "clientName",
  "guestCount",
  "venue",
];

function passingTallies(): Map<ParseEvalField, ParseEvalTally> {
  return new Map(fields.map((field) => [field, { hit: 20, total: 20, hallucinated: 0 }]));
}

describe("parse eval quality gate", () => {
  it("passes an accurate, grounded model", () => {
    expect(assessParseQuality(passingTallies())).toMatchObject({ pass: true, reasons: [] });
  });

  it("fails when aggregate accuracy misses the quality floor", () => {
    const tallies = passingTallies();
    tallies.set("clientName", { hit: 5, total: 20, hallucinated: 0 });

    const result = assessParseQuality(tallies);

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/overall/i);
  });

  it("fails a single wrong inquiry decision even when aggregate accuracy is high", () => {
    const tallies = passingTallies();
    tallies.set("isInquiry", { hit: 19, total: 20, hallucinated: 0 });

    const result = assessParseQuality(tallies);

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/isInquiry/i);
  });

  it("fails unreliable event-date extraction", () => {
    const tallies = passingTallies();
    tallies.set("eventDate", { hit: 18, total: 20, hallucinated: 0 });

    const result = assessParseQuality(tallies);

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/eventDate/i);
  });

  it("fails any invented field even when every other score is perfect", () => {
    const tallies = passingTallies();
    tallies.set("venue", { hit: 20, total: 20, hallucinated: 1 });

    const result = assessParseQuality(tallies);

    expect(result.pass).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/hallucinations/i);
  });

  it("fails closed when no cases were scored", () => {
    const empty = new Map(
      fields.map((field) => [field, { hit: 0, total: 0, hallucinated: 0 }]),
    );

    expect(assessParseQuality(empty).pass).toBe(false);
  });
});
