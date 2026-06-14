import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Terms of Service (draft) — Bright Ears",
  description:
    "The terms that govern your use of Bright Ears, the AI back office for performer businesses. Draft, pending legal review.",
  robots: { index: false, follow: true },
};

const CONTACT = "privacy@brightears.io";

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Legal — Terms"
      title="Terms of "
      gradientWord="Service"
      lead="These terms govern your use of Bright Ears. By signing up, you agree to them. They cover your subscription, what you and we are each responsible for, billing, and the limits of what the service does."
    >
      <LegalSection kicker="The agreement" title="Acceptance of these terms">
        <p>
          By creating an account or using Bright Ears, you agree to these terms. If you are using the
          service on behalf of a business, you confirm you are authorised to bind that business. If you
          do not agree, do not use the service.
        </p>
      </LegalSection>

      <LegalSection kicker="What you get" title="The service">
        <p>
          Bright Ears is an AI back office for wedding and event performer businesses. It ingests the
          inquiries your business receives, triages spam, drafts replies in your voice, lets you approve
          them, and runs follow-up sequences. An optional proactive agent can draft and send outreach to
          venues on your behalf. Features available to you depend on your plan.
        </p>
        <p>
          The service is provided to help you respond faster and follow up reliably. It does not
          guarantee bookings, revenue, or any specific outcome. AI-generated drafts may contain errors;
          you are responsible for reviewing and approving messages, except where you choose to enable
          per-source automatic sending.
        </p>
      </LegalSection>

      <LegalSection kicker="Your account" title="Eligibility, accounts and acceptable use">
        <ul className="list-disc space-y-2 pl-5">
          <li>You must provide accurate account information and keep your credentials secure.</li>
          <li>You are responsible for all activity under your account.</li>
          <li>
            You must not use the service to send unlawful, deceptive, harassing or unsolicited messages
            in breach of applicable anti-spam and electronic-marketing law (e.g. CAN-SPAM, PECR, CASL,
            the Spam Act), or to impersonate others.
          </li>
          <li>
            You must not attempt to reverse engineer, disrupt, overload, or gain unauthorised access to
            the service.
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="Data responsibilities" title="Your data, and our role as processor">
        <p>
          For the personal data of your leads and clients that flows through the product, you are the
          data controller and Bright Ears is the processor. You are responsible for having a valid legal
          basis for that data and for the messages you send. Our handling of that data is governed by the{" "}
          <Link href="/privacy" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Privacy Policy
          </Link>{" "}
          and the{" "}
          <Link href="/dpa" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Data Processing Addendum
          </Link>
          , which form part of these terms.
        </p>
        <p>
          Where you enable the proactive outreach agent, you instruct us to process publicly available
          business contact data and to send outreach on your behalf. You remain responsible for ensuring
          that your outreach complies with applicable law, including honouring opt-outs.
        </p>
      </LegalSection>

      <LegalSection kicker="Billing" title="Plans, billing and refunds">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Plans are billed on a recurring basis through Stripe. Your plan sets your monthly lead
            capacity and the features available to you.
          </li>
          <li>
            We do not send surprise overage bills. At your plan&rsquo;s cap, drafting pauses and we
            prompt you to add capacity rather than charging automatically.
          </li>
          <li>
            You start with a 14-day free trial (no card required) and can cancel at any time;
            cancellation stops future renewals. Any refund or money-back terms, if and when we offer
            them, will be stated explicitly here and on the pricing page before they apply.
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="Ownership" title="Intellectual property">
        <p>
          Bright Ears and its software, design and content are owned by us. You retain ownership of your
          business content (profile, packages, voice samples) and your leads&rsquo; data. You grant us the
          rights needed to process that content to provide the service.
        </p>
      </LegalSection>

      <LegalSection kicker="The fine print" title="Disclaimers and limitation of liability">
        <p>
          The service is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties
          of any kind to the fullest extent permitted by law. We do not warrant that the service will be
          uninterrupted, error-free, or that AI-generated content will be accurate.
        </p>
        <p>
          To the fullest extent permitted by law, our liability arising out of or relating to the service
          is limited, and we are not liable for indirect, incidental, special or consequential damages, or
          for lost profits or bookings. Specific liability caps will be set in legal review.
        </p>
      </LegalSection>

      <LegalSection kicker="Ending it" title="Suspension and termination">
        <p>
          You may stop using the service at any time. We may suspend or terminate access if you breach
          these terms or use the service unlawfully. On termination, your data is handled per the Privacy
          Policy and the Data Processing Addendum.
        </p>
      </LegalSection>

      <LegalSection kicker="Changes & law" title="Changes, governing law and contact">
        <p>
          We may update these terms; material changes will be communicated, and continued use after the
          effective date constitutes acceptance. The governing law and dispute-resolution venue will be
          confirmed in legal review.
        </p>
        <p>
          Questions about these terms can be sent to{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
