import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifyOptoutToken } from "@/lib/optout";

export async function GET(req: NextRequest) {
  const leadId = req.nextUrl.searchParams.get("lead") ?? "";
  const token = req.nextUrl.searchParams.get("token") ?? "";
  if (!leadId || !verifyOptoutToken(leadId, token)) {
    return new NextResponse("Invalid link.", { status: 400 });
  }

  await db.$transaction([
    db.lead.update({
      where: { id: leadId },
      data: { optedOut: true, status: "DEAD", deadAt: new Date() },
    }),
    db.sequenceRun.updateMany({
      where: { leadId, stoppedAt: null },
      data: { stoppedAt: new Date(), stopReason: "opted_out" },
    }),
  ]).catch(() => null); // unknown lead id with valid-shaped token: still show success (no enumeration)

  return new NextResponse(
    "<html><body style='font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center'><h2>You're unsubscribed.</h2><p>You won't receive any more messages about this inquiry.</p></body></html>",
    { headers: { "content-type": "text/html" } },
  );
}
