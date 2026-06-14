import { NextRequest, NextResponse } from "next/server";
import { generateDraft } from "@/lib/agent/drafter";

/**
 * Public demo: paste an inquiry → watch a reply draft itself. This is a free
 * LLM call exposed to the internet, so limits are strict:
 * - 5 demos per IP per day (in-memory; resets on deploy — fine for a demo)
 * - 500 global per day
 * - input capped at 1,200 chars
 */
const ipCounts = new Map<string, { count: number; day: string }>();
let globalCount = { count: 0, day: "" };
const today = () => new Date().toISOString().slice(0, 10);

const DEMO_PACKAGES = [
  { name: "Wedding Essentials (6h)", description: "Ceremony + reception DJ, MC duties, dance floor lighting.", priceMin: 180000, priceMax: 220000, eventTypes: ["wedding"] },
  { name: "Corporate / Private Party (4h)", description: "DJ + full sound system.", priceMin: 90000, priceMax: 120000, eventTypes: ["corporate", "birthday", "private party"] },
];

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const day = today();

  if (globalCount.day !== day) {
    globalCount = { count: 0, day };
    ipCounts.clear(); // prevent unbounded growth on a long-lived server
  }
  if (globalCount.count >= 500) {
    return NextResponse.json({ error: "Demo is taking a breather — try again tomorrow!" }, { status: 429 });
  }
  const entry = ipCounts.get(ip);
  const used = entry?.day === day ? entry.count : 0;
  if (used >= 5) {
    return NextResponse.json(
      { error: "You've used today's 5 demo replies — subscribe to get unlimited." },
      { status: 429 },
    );
  }

  let inquiry: string;
  try {
    const body = (await req.json()) as { inquiry?: string };
    inquiry = (body.inquiry ?? "").trim().slice(0, 1200);
  } catch {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  if (inquiry.length < 20) {
    return NextResponse.json({ error: "Paste a real inquiry (at least a sentence or two)." }, { status: 400 });
  }

  ipCounts.set(ip, { count: used + 1, day });
  globalCount.count++;

  const draft = await generateDraft({
    business: {
      id: null, // demo: no tenant usage logging
      name: "Your DJ Business",
      ownerName: "you",
      performerKind: "DJ",
      country: "US",
      voiceSamples: "Hey! Thanks so much for reaching out — congrats! We keep things fun and stress-free: you tell us the vibe, we handle the rest.",
    },
    packages: DEMO_PACKAGES,
    lead: { source: "WEBSITE_FORM", message: inquiry },
    availability: { state: "unknown" },
    thread: [],
    sequenceStep: 0,
  });

  return NextResponse.json({ subject: draft.subject, body: draft.body, remaining: 4 - used });
}
