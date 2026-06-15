import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy (draft) — Bright Ears",
  description:
    "How Bright Ears uses cookies. Strictly-necessary authentication and security cookies only — consent-exempt under ePrivacy/PECR. No advertising or cross-site tracking. Stripe sets its cookies on its own checkout domain, not ours. Draft, pending legal review.",
  robots: { index: false, follow: true },
};

const CONTACT = "privacy@brightears.io";

/** Per-cookie disclosure rows (name / provider / purpose / duration). */
const COOKIE_ROWS: { name: string; provider: string; purpose: string; duration: string }[] = [
  {
    name: "__session / __client*",
    provider: "Clerk",
    purpose: "Keeps you securely signed in and maintains your authenticated session.",
    duration: "Session / up to ~7 days",
  },
  {
    name: "__clerk_db_jwt",
    provider: "Clerk",
    purpose: "Auth token used to validate your session on each request.",
    duration: "Session",
  },
  {
    name: "CSRF / security token",
    provider: "Bright Ears",
    purpose: "Protects against cross-site request forgery on form and action submissions.",
    duration: "Session",
  },
];

export default function CookiesPage() {
  return (
    <LegalPage
      kicker="Legal — Cookies"
      title="Cookie "
      gradientWord="Policy"
      lead="The honest version: Bright Ears uses strictly-necessary cookies to keep you signed in securely. We do not run advertising or cross-site tracking cookies, and we do not need a consent banner."
    >
      <LegalSection kicker="What they are" title="What cookies are">
        <p>
          Cookies are small files a site stores in your browser. They let a site remember things between
          page loads — most importantly, that you are signed in. Some serve essential functions; others
          (which we do not use) track people across sites for advertising.
        </p>
      </LegalSection>

      <LegalSection kicker="What we use" title="The cookies we set (all strictly necessary)">
        <p>
          Bright Ears sets only <span className="font-semibold text-ink-stage">strictly-necessary</span>{" "}
          cookies: authentication/session cookies from our auth provider, Clerk, and a security token to
          protect against cross-site request forgery. Under the EU ePrivacy Directive and the UK PECR,
          strictly-necessary cookies are <span className="font-semibold text-ink-stage">exempt from the
          consent requirement</span> — so there is no cookie banner. We still disclose them here.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-ink-stage/15">
                <th className="py-2 pr-4 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/50">
                  Cookie
                </th>
                <th className="py-2 pr-4 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/50">
                  Provider
                </th>
                <th className="py-2 pr-4 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/50">
                  Purpose
                </th>
                <th className="py-2 font-mono text-[10px] font-bold uppercase tracking-[0.14em] text-ink-stage/50">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="text-ink-stage/80">
              {COOKIE_ROWS.map((c) => (
                <tr key={c.name} className="border-b border-ink-stage/10 align-top">
                  <td className="py-3 pr-4 font-mono text-[0.85em] text-ink-stage">{c.name}</td>
                  <td className="py-3 pr-4">{c.provider}</td>
                  <td className="py-3 pr-4">{c.purpose}</td>
                  <td className="py-3 whitespace-nowrap">{c.duration}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-ink-stage/70">
          Exact cookie names set by Clerk can vary with their SDK version; the purpose and category above
          do not change.
        </p>
      </LegalSection>

      <LegalSection kicker="Payments" title="A note on Stripe and checkout">
        <p>
          We use Stripe for billing, but our checkout and customer portal are{" "}
          <span className="font-semibold text-ink-stage">Stripe-hosted</span> — when you subscribe or
          manage billing, you are redirected to Stripe&rsquo;s own pages. Stripe&rsquo;s own cookies (such
          as <span className="font-mono text-[0.9em]">__stripe_mid</span> and{" "}
          <span className="font-mono text-[0.9em]">__stripe_sid</span>) are therefore set on{" "}
          <span className="font-semibold text-ink-stage">Stripe&rsquo;s domain, not ours</span>. Bright
          Ears does not load Stripe&rsquo;s client-side script on its own pages, so no Stripe cookie is set
          while you browse Bright Ears.
        </p>
      </LegalSection>

      <LegalSection kicker="What we don't use" title="No advertising, no cross-site tracking">
        <p>
          We do not use advertising cookies, cross-site tracking pixels, or third-party marketing
          trackers, and we do not sell your data. If we ever introduce non-essential cookies (for example,
          optional analytics), we will update this policy and add a compliant consent mechanism —
          with Accept-All and Reject-All offered at equal prominence — before any such cookie is set.
        </p>
      </LegalSection>

      <LegalSection kicker="Your controls" title="Managing cookies">
        <p>
          You can block or delete cookies in your browser settings. Because our cookies are strictly
          necessary, blocking them will prevent you from signing in and using the app.
        </p>
      </LegalSection>

      <LegalSection kicker="More" title="Related policies and contact">
        <p>
          For the full picture of how we handle personal data, see the{" "}
          <Link href="/privacy" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Privacy Policy
          </Link>
          . Questions about cookies can be sent to{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
