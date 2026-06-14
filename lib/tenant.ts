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

/** First sign-in: provision the tenant — business, owner membership, the
 *  unsubscribed gating state, and the default follow-up sequence so the engine
 *  works the moment they subscribe.
 *
 *  NO FREE TRIAL (founder decision, 2026-06-14): the risk-reversal is a 30-day
 *  money-back guarantee, not a free window — see lib/marketing/guarantee.ts.
 *  New tenants may ONBOARD and set up for free (profile, packages, voice,
 *  calendar), but the live agent — drafting replies, generating/sending venue
 *  pitches — requires an ACTIVE PAID subscription. We represent "unsubscribed"
 *  with the existing TRIAL enum value + `trialEndsAt` in the PAST, which the
 *  metering layer already reads as "agent paused, no free lead allowance"
 *  (lib/billing/metering.ts: trialExpired → overCap). Reusing the expired-trial
 *  path keeps the change minimal and fully reversible: a successful Stripe
 *  checkout flips `plan` to the paid tier and clears `trialEndsAt`. */
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
      plan: "TRIAL",
      // Unsubscribed from day one: epoch is unambiguously in the past, so the
      // agent is paused (subscribe to activate) while onboarding stays free.
      trialEndsAt: new Date(0),
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
