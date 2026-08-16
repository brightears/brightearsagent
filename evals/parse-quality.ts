export type ParseEvalField =
  | "isInquiry"
  | "eventType"
  | "eventDate"
  | "clientName"
  | "guestCount"
  | "venue";

export interface ParseEvalTally {
  hit: number;
  total: number;
  hallucinated: number;
}

export interface ParseQualityThresholds {
  overallAccuracy: number;
  inquiryAccuracy: number;
  eventDateAccuracy: number;
  maxHallucinations: number;
}

export const PARSE_QUALITY_THRESHOLDS: ParseQualityThresholds = {
  overallAccuracy: 0.9,
  // Dropping a real inquiry (or accepting obvious junk) breaks the entire
  // workflow, so every ground-truth inquiry decision must be correct.
  inquiryAccuracy: 1,
  // A missing date disables the availability check. Allow at most rare
  // repeated-run flakiness while keeping the default one-run suite strict.
  eventDateAccuracy: 0.95,
  // Invented facts are never an acceptable trade for extraction recall.
  maxHallucinations: 0,
};

export interface ParseQualityAssessment {
  pass: boolean;
  overallAccuracy: number;
  hallucinations: number;
  reasons: string[];
}

function accuracy(tally: ParseEvalTally | undefined): number | null {
  if (!tally?.total) return null;
  return tally.hit / tally.total;
}

export function assessParseQuality(
  tallies: ReadonlyMap<ParseEvalField, ParseEvalTally>,
  thresholds: ParseQualityThresholds = PARSE_QUALITY_THRESHOLDS,
): ParseQualityAssessment {
  const values = [...tallies.values()];
  const hit = values.reduce((sum, tally) => sum + tally.hit, 0);
  const total = values.reduce((sum, tally) => sum + tally.total, 0);
  const hallucinations = values.reduce((sum, tally) => sum + tally.hallucinated, 0);
  const overallAccuracy = total ? hit / total : 0;
  const inquiryAccuracy = accuracy(tallies.get("isInquiry"));
  const eventDateAccuracy = accuracy(tallies.get("eventDate"));
  const reasons: string[] = [];

  if (!total) reasons.push("no scored cases");
  if (overallAccuracy < thresholds.overallAccuracy) {
    reasons.push(
      `overall ${(overallAccuracy * 100).toFixed(1)}% < ${(thresholds.overallAccuracy * 100).toFixed(0)}%`,
    );
  }
  if (inquiryAccuracy === null) {
    reasons.push("isInquiry has no scored cases");
  } else if (inquiryAccuracy < thresholds.inquiryAccuracy) {
    reasons.push(
      `isInquiry ${(inquiryAccuracy * 100).toFixed(1)}% < ${(thresholds.inquiryAccuracy * 100).toFixed(0)}%`,
    );
  }
  if (eventDateAccuracy === null) {
    reasons.push("eventDate has no scored cases");
  } else if (eventDateAccuracy < thresholds.eventDateAccuracy) {
    reasons.push(
      `eventDate ${(eventDateAccuracy * 100).toFixed(1)}% < ${(thresholds.eventDateAccuracy * 100).toFixed(0)}%`,
    );
  }
  if (hallucinations > thresholds.maxHallucinations) {
    reasons.push(`hallucinations ${hallucinations} > ${thresholds.maxHallucinations}`);
  }

  return { pass: reasons.length === 0, overallAccuracy, hallucinations, reasons };
}
