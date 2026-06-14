import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Cookie Policy (draft) — Bright Ears",
  description:
    "How Bright Ears uses cookies. Essential authentication cookies only — no advertising or cross-site tracking. Draft, pending legal review.",
  robots: { index: false, follow: true },
};

const CONTACT = "privacy@brightears.io";

export default function CookiesPage() {
  return (
    <LegalPage
      kicker="Legal — Cookies"
      title="Cookie "
      gradientWord="Policy"
      lead="The honest version: Bright Ears uses essential cookies to keep you signed in securely. We do not run advertising or cross-site tracking cookies."
    >
      <LegalSection kicker="What they are" title="What cookies are">
        <p>
          Cookies are small files a site stores in your browser. They let a site remember things between
          page loads — most importantly, that you are signed in. Some serve essential functions; others
          (which we do not use) track people across sites for advertising.
        </p>
      </LegalSection>

      <LegalSection kicker="What we use" title="The cookies we set">
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">Essential authentication and session cookies.</span>{" "}
            Set by our authentication provider, Clerk, so you can sign in and stay signed in securely.
            Without these, the app cannot keep you logged in.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Essential operational cookies.</span> A small
            number of cookies needed for security and core functionality (for example, to protect against
            cross-site request forgery).
          </li>
        </ul>
        <p>
          These are strictly necessary cookies. Under UK/EU rules, strictly necessary cookies do not
          require consent, but we still tell you about them here.
        </p>
      </LegalSection>

      <LegalSection kicker="What we don't use" title="No advertising, no tracking">
        <p>
          We do not use advertising cookies, cross-site tracking pixels, or third-party marketing trackers.
          We do not sell your data. If we ever introduce non-essential cookies (for example, optional
          analytics), we will update this policy and add a consent mechanism first.
        </p>
      </LegalSection>

      <LegalSection kicker="Your controls" title="Managing cookies">
        <p>
          You can block or delete cookies in your browser settings. Because our cookies are essential,
          blocking them will prevent you from signing in and using the app.
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
