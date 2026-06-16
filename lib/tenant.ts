import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

const clerkEnabled = !!process.env.CLERK_SECRET_KEY;

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30) || "business";
}

/** First sign-in: provision the tenant — business, owner membership, and the
 *  default follow-up sequence so the engine works from the very first lead.
 *
 *  NO AUTOMATIC FREE TRIAL (founder decision, 2026-06-16): new tenants start on
 *  `plan=TRIAL` meaning "free / not subscribed", and the agent is PAUSED
 *  (lib/billing/metering.ts: isAgentPaused) until they subscribe. There is no
 *  time-based trial — a free trial was gameable (sign up, grab gigs, churn,
 *  re-sign with a new email). Instead, selected artists get a Stripe PROMOTION
 *  CODE (a 100%-off-first-month coupon the founder mints in the Stripe
 *  Dashboard) to enter at checkout, which makes their first month free; they're
 *  a normal paid subscriber to us. A successful Stripe checkout flips `plan` to
 *  the paid tier (webhook). They can finish onboarding, but the agent only
 *  starts working once subscribed. */
async function createBusinessForUser(clerkUserId: string, email: string, name: string) {
  const base = slugify(email.split("@")[0]);
  // Find a free slug (base, base-2, base-3...).
  let slug = base;
  for (let i = 2; await db.business.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }
  return db.business.create({
    data: {
      name: name ? `${name}'s Business` : "My Business",
      slug,
      ownerEmail: email,
      ownerName: name || email.split("@")[0],
      // plan=TRIAL = "free / not subscribed" → the agent is paused until they
      // subscribe (no auto free trial). trialEndsAt is unused now.
      plan: "TRIAL",
      members: { create: { email, name: name || email, isOwner: true, clerkUserId } },
      sequences: { create: { stepsDays: [2, 5, 9] } },
    },
  });
}

/**
 * Tenant resolution, in priority order:
 * 1. DEV_TENANT_SLUG (non-production only) — used by scripts/tests.
 * 2. Clerk session — member lookup by clerkUserId, adoption by email, or
 *    first-login tenant provisioning.
 * 3. Dev fallback (no Clerk keys): the seeded demo business.
 */
export async function getCurrentBusiness() {
  if (process.env.DEV_TENANT_SLUG && process.env.NODE_ENV !== "production") {
    const business = await db.business.findUnique({
      where: { slug: process.env.DEV_TENANT_SLUG },
    });
    if (!business) throw new Error(`DEV_TENANT_SLUG ${process.env.DEV_TENANT_SLUG} not found`);
    return business;
  }

  if (clerkEnabled) {
    const { userId } = await auth();
    if (!userId) throw new Error("Not signed in");

    const byClerkId = await db.member.findFirst({
      where: { clerkUserId: userId },
      include: { business: true },
    });
    if (byClerkId) return byClerkId.business;

    const user = await currentUser();
    const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
    if (!email) throw new Error("Your account has no email address");

    // Adopt a pre-created membership (e.g. invited member) by email.
    const byEmail = await db.member.findFirst({
      where: { email, clerkUserId: null },
      include: { business: true },
    });
    if (byEmail) {
      await db.member.update({ where: { id: byEmail.id }, data: { clerkUserId: userId } });
      return byEmail.business;
    }

    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
    return createBusinessForUser(userId, email, fullName);
  }

  // No Clerk configured: dev single-tenant mode.
  const business = await db.business.findFirst({
    where: { slug: "demo-dj-co" },
  });
  if (!business) throw new Error("No tenant — run `npm run db:seed`");
  return business;
}
