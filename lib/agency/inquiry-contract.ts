import { z } from "zod";

const text = (max: number) => z.string().trim().max(max);
export const inquirySchema = z.object({
  submissionKey: z.uuid(),
  locale: z.enum(["en", "th"]),
  // Added sources and brief fields are optional extensions: the intake worker
  // relays `source` and `brief` as opaque JSON, and older cached forms omit them.
  source: z.enum(["home", "venues", "events", "artist", "acts", "bangkok", "pattaya", "new-years-eve"]),
  website: text(200).optional().default(""),
  brief: z.object({
    occasion: text(100).min(1),
    venue: text(100).min(1),
    date: text(10).refine(value => !value || /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value),
    time: text(100),
    guests: text(50),
    sound: text(100).min(1),
    details: text(500),
    name: text(80).min(1),
    email: z.email().max(150).transform(value => value.trim().toLowerCase()),
    venueType: text(100).optional(),
    nightsPerWeek: text(100).optional(),
    actType: text(100).optional(),
  }).strict(),
}).strict();
export type AgencyInquiryInput = z.infer<typeof inquirySchema>;
export type InquirySource = AgencyInquiryInput["source"];

export class InquiryError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

export async function boundedJson(request: Request, maxBytes = 8192): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new InquiryError(415, "json_required");
  }
  const body = await boundedBytes(request, maxBytes);
  try {
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(body));
  } catch { throw new InquiryError(400, "invalid_request"); }
}

/** Reads at most maxBytes, whatever Content-Length claims, then stops the stream. */
export async function boundedBytes(request: Request, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> {
  const declared = request.headers.get("content-length");
  if (declared && Number(declared) > maxBytes) throw new InquiryError(413, "body_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new InquiryError(400, "invalid_request");
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        throw new InquiryError(413, "body_too_large");
      }
      chunks.push(value);
    }
    const body = new Uint8Array(bytes);
    let offset = 0;
    for (const chunk of chunks) { body.set(chunk, offset); offset += chunk.byteLength; }
    return body;
  } catch (error) {
    if (error instanceof InquiryError) throw error;
    throw new InquiryError(400, "invalid_request");
  } finally { reader.releaseLock(); }
}
