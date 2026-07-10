import { db } from "@/lib/db";
import { getCurrentBusiness } from "@/lib/tenant";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// Live forwarding verifier for onboarding step 5: the wizard polls this every
// 5s while the owner sends a test email (or forwards a real inquiry) to their
// lead address. "Verified" = any Lead row for this tenant in the last 10
// minutes — spam-triaged test emails still count, because a Lead row proves
// the forward → inbound parse path works end to end.

export const dynamic = "force-dynamic";

const WINDOW_MS = 10 * 60 * 1000;

export async function GET(req: Request) {
  // Generous cap (audit B10): the wizard polls every 5s (~12/min); this only
  // trips on a runaway client.
  if (!rateLimit(`verify:${clientIp(req)}`, 120, 60_000).ok) {
    return Response.json({ verified: false, error: "rate-limited" }, { status: 429 });
  }

  let business;
  try {
    business = await getCurrentBusiness();
  } catch {
    return Response.json({ verified: false, error: "no-tenant" }, { status: 401 });
  }

  const lead = await db.lead.findFirst({
    where: {
      businessId: business.id,
      createdAt: { gte: new Date(Date.now() - WINDOW_MS) },
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, clientName: true, rawSubject: true, createdAt: true },
  });

  // Gmail's forwarding-approval link, if its verification email arrived (the
  // pipeline intercepts + stores it — lib/inbound/forwarding-confirmation.ts).
  // Surfaced here so the step-5 poll shows the approval card live.
  const forwardingConfirmation =
    business.forwardingConfirmUrl || business.forwardingConfirmCode
      ? {
          url: business.forwardingConfirmUrl,
          code: business.forwardingConfirmCode,
        }
      : null;

  return Response.json({
    verified: lead !== null,
    lead: lead && {
      id: lead.id,
      clientName: lead.clientName,
      subject: lead.rawSubject,
      receivedAt: lead.createdAt,
    },
    forwardingConfirmation,
  });
}
