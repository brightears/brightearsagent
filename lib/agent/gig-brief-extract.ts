import { z } from "zod";
import { llmObject } from "@/lib/llm";

// Thread extraction for the gig brief (P11.3). EXTRACTION ONLY — the brief
// is what the artist carries into the room, so an invented "load-in at 4pm"
// is worse than a blank section. Same discipline as the inbound fallback
// parser: only what the conversation literally says; empty when unsure.

const BriefExtractionSchema = z.object({
  setTimes: z
    .string()
    .nullish()
    .describe(
      "performance timing ONLY if explicitly stated in the conversation, e.g. '6pm to 11pm' or 'two 45-minute sets'; null otherwise",
    ),
  specialRequests: z
    .array(z.string())
    .describe(
      "the client's explicit asks, one per item, in their own terms: specific songs, do-not-play lists, announcements, a first dance, dress code, surprises. Empty array when none were stated.",
    ),
  practicalNotes: z
    .array(z.string())
    .describe(
      "logistics explicitly stated: load-in/setup times, parking, power, stage or space constraints, on-the-day contact person, address specifics. Empty array when none were stated.",
    ),
});

export type BriefExtraction = z.infer<typeof BriefExtractionSchema>;

const clean = (items: string[]) => items.map((s) => s.trim()).filter(Boolean).slice(0, 6);

export async function extractGigBrief(opts: {
  businessId: string | null;
  thread: { direction: "INBOUND" | "OUTBOUND"; body: string }[];
}): Promise<{ setTimes: string | null; specialRequests: string[]; practicalNotes: string[] }> {
  const lines = opts.thread
    .slice(-12)
    .map((m) => `${m.direction === "INBOUND" ? "CLIENT" : "US"}: ${m.body.slice(0, 800)}`)
    .join("\n---\n");

  const extracted = await llmObject({
    purpose: "parse",
    businessId: opts.businessId,
    system:
      "You extract gig-day logistics from a booking conversation between an entertainment act and their client. " +
      "Extract ONLY what is explicitly present in the messages — never guess, never invent, never infer defaults. " +
      "If a category has nothing explicit, return it empty (or null). Short plain phrases, no commentary.",
    prompt: `CONVERSATION:\n${lines}`,
    schema: BriefExtractionSchema,
  });

  return {
    setTimes: extracted.setTimes?.trim() || null,
    specialRequests: clean(extracted.specialRequests ?? []),
    practicalNotes: clean(extracted.practicalNotes ?? []),
  };
}
