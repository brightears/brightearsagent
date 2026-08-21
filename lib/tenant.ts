import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { reportError } from "@/lib/report-error";
import { betaWindowForInvite } from "@/lib/billing/beta";

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
 *  Ordinary new tenants start on `plan=TRIAL` meaning "free / not subscribed"
 *  and stay paused until checkout. A founder-approved beta email is the narrow
 *  exception: Clerk first verifies the primary email, then this provisioning
 *  surface writes one non-renewing 30-day Starter entitlement. No Stripe
 *  customer, checkout session, card or subscription is created. The existing
 *  membership-adoption ladder prevents deleting/recreating a Clerk identity
 *  from restarting the window for the same email. */
async function createBusinessForUser(clerkUserId: string, email: string, name: string) {
  const base = slugify(email.split("@")[0]);
  // Find a free slug (base, base-2, base-3...).
  let slug = base;
  for (let i = 2; await db.business.findUnique({ where: { slug } }); i++) {
    slug = `${base}-${i}`;
  }
  const betaWindow = betaWindowForInvite(email, process.env.BETA_COMP_EMAILS);
  return db.business.create({
    data: {
      name: name ? `${name}'s Business` : "My Business",
      slug,
      ownerEmail: email,
      ownerName: name || email.split("@")[0],
      // The stored plan stays TRIAL even for a beta. Runtime entitlement gates
      // recognize only the server-authored beta window and apply Starter caps;
      // this keeps beta usage out of paid subscription/margin reporting.
      plan: "TRIAL",
      ...(betaWindow ?? {}),
      members: { create: { email, name: name || email, isOwner: true, clerkUserId } },
      sequences: { create: { stepsDays: [2, 5, 9] } },
    },
  });
}

/** Signed in, but no business belongs to this identity. */
export class NoTenantError extends Error {
  constructor(public readonly email: string) {
    super(`No business is linked to ${email}`);
    this.name = "NoTenantError";
  }
}

/**
 * Tenant resolution, in priority order:
 * 1. DEV_TENANT_SLUG (non-production only) — used by scripts/tests.
 * 2. Clerk session — member lookup by clerkUserId, adoption by email, or
 *    (only where `provision` is asked for) first-login tenant creation.
 * 3. Dev fallback (no Clerk keys): the seeded demo business.
 *
 * `provision` is OFF by default, and that default is the point. Creating a
 * tenant used to be the unconditional last rung, so ANY signed-in identity we
 * failed to recognise silently got a brand-new empty business — from any
 * surface, with no error and no trace. That is not theoretical: it is how this
 * account ended up with three, one of which quietly collected the live Stripe
 * subscription while the real business sat on TRIAL with its agent paused.
 * With Google One Tap enabled on the production Clerk instance, one stray click
 * on the wrong Google account is enough to trigger it, and the tenant it hands
 * back looks plausible because it is built from the same person's profile.
 *
 * So provisioning now happens in exactly one place — the sign-up funnel at
 * /onboarding, which is where Clerk's post-sign-up redirect lands and the only
 * context where "we have never seen you" genuinely means "new customer".
 * Everywhere else fails closed and alerts, because on the dashboard or in a
 * server action that same state means something is wrong, and inventing an
 * empty workspace is the least helpful possible response.
 */
export async function getCurrentBusiness(opts: { provision?: boolean } = {}) {
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

    // Adopt a membership by email. An unclaimed row (an invite that has never
    // been signed into) wins; failing that we re-claim a row still bound to a
    // Clerk user id that no longer resolves.
    //
    // That second case is not hypothetical — it is what an instance swap looks
    // like (apex cutover, 2026-07-27). Clerk's development and production
    // instances are separate user pools: a production instance cloned from dev
    // copies the settings, never the users. So every id written before the
    // pk_live swap names a user production has never heard of, the lookup above
    // misses forever, and without this fallback the owner would sign in on the
    // live domain and be handed a pristine EMPTY tenant while their real
    // business — subscription, leads, EPK, venue pipeline — sat orphaned in the
    // same database with nobody able to reach it.
    //
    // Re-claiming grants nothing new: Clerk only hands us an email it has
    // verified (code or OAuth) and enforces one verified email per user within
    // an instance, so the only person who can take this row is the person whose
    // mailbox it already names.
    const byEmail =
      (await db.member.findFirst({
        where: { email, clerkUserId: null },
        include: { business: true },
      })) ??
      (await db.member.findFirst({
        where: { email },
        include: { business: true },
        orderBy: { createdAt: "asc" },
      }));
    if (byEmail) {
      await db.member.update({ where: { id: byEmail.id }, data: { clerkUserId: userId } });
      return byEmail.business;
    }

    if (!opts.provision) {
      // Loud on purpose. With a small tenant count the founder can eyeball
      // every one of these, and each is either a customer locked out of their
      // own data or someone signed in on the wrong account.
      await reportError(new NoTenantError(email), {
        kind: "tenant_missing",
        clerkUserId: userId,
        email,
        message: "Signed-in identity has no business, and this surface does not provision. Refusing to invent one.",
      });
      throw new NoTenantError(email);
    }

    const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ");
    const created = await createBusinessForUser(userId, email, fullName);
    // Every new tenant is an event worth seeing while the customer count is
    // small — it is either a real signup worth celebrating or the duplicate
    // that would otherwise be discovered weeks later.
    console.warn(
      JSON.stringify({
        level: "warn",
        kind: "tenant_provisioned",
        businessId: created.id,
        slug: created.slug,
        email,
        clerkUserId: userId,
        beta: Boolean(created.betaStartedAt && created.trialEndsAt),
        ts: new Date().toISOString(),
      }),
    );
    return created;
  }

  // A missing server key must never turn production into demo-tenant mode.
  // The publishable key can still make the proxy authenticate the request,
  // while this module (which needs the secret) would otherwise hand every
  // signed-in visitor the seeded demo tenant. /api/health also rejects this
  // configuration, but the data boundary defends itself independently.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "CLERK_SECRET_KEY is not configured in production — refusing demo tenant fallback",
    );
  }

  // No Clerk configured: local-development single-tenant mode only.
  const business = await db.business.findFirst({
    where: { slug: "demo-dj-co" },
  });
  if (!business) throw new Error("No tenant — run `npm run db:seed`");
  return business;
}
