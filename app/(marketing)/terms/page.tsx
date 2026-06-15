import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, ToBeCompleted } from "@/components/legal-page";
import { RISK_REVERSAL } from "@/lib/marketing/guarantee";

export const metadata: Metadata = {
  title: "Terms of Service (draft) — Bright Ears",
  description:
    "The terms that govern your use of Bright Ears, the AI back office for performer businesses, contracted with Bright Ears Co., Ltd. (Thailand). Draft, pending legal review.",
  robots: { index: false, follow: true },
};

const CONTACT = "info@brightears.io";

export default function TermsPage() {
  return (
    <LegalPage
      kicker="Legal — Terms"
      title="Terms of "
      gradientWord="Service"
      lead="These terms govern your use of Bright Ears. By signing up, you agree to them. They cover your subscription, what you and we are each responsible for, billing and auto-renewal, anti-spam responsibility, and the limits of what the service does."
    >
      <LegalSection kicker="The agreement" title="Who you are contracting with, and acceptance">
        <p>
          Bright Ears is operated by{" "}
          <span className="font-semibold text-ink-stage">Bright Ears Co., Ltd.</span>, a company
          registered in Thailand (registration number{" "}
          0105550096659, registered office{" "}
          {/* TODO(founder): registered office address in Thailand */}
          <ToBeCompleted label="registered address" />). By creating an account or using Bright Ears, you
          agree to these terms. If you are using the service on behalf of a business, you confirm you are
          authorised to bind that business. If you do not agree, do not use the service.
        </p>
        <p>
          Bright Ears is a tool for <span className="font-semibold text-ink-stage">businesses</span>
          (performer businesses such as DJs and bands), not for consumers. You confirm you are
          subscribing for purposes related to your trade or profession. Where, despite this, mandatory
          consumer-protection law applies to you, nothing in these terms removes a right you cannot
          legally waive (see Governing law).
        </p>
      </LegalSection>

      <LegalSection kicker="What you get" title="The service, and what it does not promise">
        <p>
          Bright Ears ingests the inquiries your business receives, triages spam, drafts replies in your
          voice, lets you approve them, and runs follow-up sequences. An optional proactive Hunt can draft
          and send outreach to venues on your behalf. Features available to you depend on your plan.
        </p>
        <p>
          <span className="font-semibold text-ink-stage">No outcome is guaranteed.</span> The service is
          provided to help you respond faster and follow up reliably. It does not guarantee bookings,
          revenue, deliverability of any message, or any other specific outcome. AI-generated drafts may
          contain errors or inaccuracies; you are responsible for reviewing and approving messages before
          they are sent, except where you choose to enable per-source automatic sending (in which case you
          accept responsibility for those automated sends).
        </p>
      </LegalSection>

      <LegalSection kicker="Your account" title="Eligibility, accounts and acceptable use">
        <ul className="list-disc space-y-2 pl-5">
          <li>You must provide accurate account information and keep your credentials secure.</li>
          <li>You are responsible for all activity under your account.</li>
          <li>
            Your use of the service — and especially all outbound messaging — must comply with our{" "}
            <Link href="/acceptable-use" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
              Acceptable Use &amp; Anti-Spam Policy
            </Link>
            , which forms part of these terms.
          </li>
          <li>
            You must not attempt to reverse engineer, disrupt, overload, or gain unauthorised access to the
            service, nor use it to impersonate others or send unlawful, deceptive or harassing messages.
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        kicker="The decisive clause"
        title="You are the sender — anti-spam responsibility and indemnity"
      >
        <p>
          For every outbound message generated or sent through Bright Ears — whether delivered via our
          Postmark infrastructure (<span className="font-mono text-[0.92em]">mail.brightears.io</span>) or
          from your own connected Google mailbox — <span className="font-semibold text-ink-stage">you are
          the legal sender and initiator of that message</span>. Bright Ears provides the tooling; you
          decide who is contacted and what is said, and you are{" "}
          <span className="font-semibold text-ink-stage">solely responsible</span> for compliance with all
          applicable anti-spam and electronic-marketing law (including CAN-SPAM, CASL, UK PECR, the
          Australian Spam Act, and the GDPR/ePrivacy rules), as detailed in the{" "}
          <Link href="/acceptable-use" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Acceptable Use &amp; Anti-Spam Policy
          </Link>
          .
        </p>
        <p>
          You agree to <span className="font-semibold text-ink-stage">indemnify and hold harmless</span>{" "}
          Bright Ears Co., Ltd. and its officers and contractors against any claims, penalties, fines,
          losses and reasonable costs arising out of messages you send (or cause to be sent) through the
          service, or out of your breach of the Acceptable Use Policy or applicable law. This indemnity
          survives termination.
        </p>
      </LegalSection>

      <LegalSection kicker="Data responsibilities" title="Your data, and our roles">
        <p>
          For the personal data of your leads and end-clients that flows through the product, you are the
          controller and Bright Ears is the processor; that handling is governed by the{" "}
          <Link href="/privacy" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Privacy Policy
          </Link>{" "}
          and the{" "}
          <Link href="/dpa" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Data Processing Addendum
          </Link>
          , which form part of these terms. For your own account data, and for the scraped venue contacts
          gathered by the Hunt, Bright Ears is the controller — see the Privacy Policy. You remain
          responsible for having a valid legal basis for your leads&rsquo; data and for the messages you
          send.
        </p>
      </LegalSection>

      <LegalSection kicker="Billing" title="Free trial, subscription, auto-renewal and cancellation">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">Free trial.</span> New accounts start with a{" "}
            <span className="font-semibold text-ink-stage">14-day free trial</span> of full Pro features —{" "}
            <span className="font-semibold text-ink-stage">no payment card required</span>. If you do not
            choose a plan before the trial ends, the agent simply pauses; your account and data are
            retained.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Subscription and prices.</span> Paid plans are
            billed monthly through Stripe and renew automatically: Starter{" "}
            <span className="font-semibold text-ink-stage">$25/month</span>, Pro{" "}
            <span className="font-semibold text-ink-stage">$79/month</span>, Studio{" "}
            <span className="font-semibold text-ink-stage">$149/month</span>. Your plan sets your monthly
            inbound-lead capacity and the features available to you. We do not send surprise overage bills —
            at your plan&rsquo;s cap, drafting pauses and we prompt you to add capacity rather than charging
            automatically.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Auto-renewal disclosure (express consent).</span>{" "}
            When you add a payment method and convert from trial to a paid plan, you are enrolling in an{" "}
            <span className="font-semibold text-ink-stage">automatically renewing subscription</span>: it
            continues each month at the price above and your card is charged each renewal until you cancel.
            By subscribing you give express consent to these recurring charges. This disclosure is provided
            clearly and conspicuously at the point of subscribing, consistent with the California
            Automatic Renewal Law, the US ROSCA / FTC Act §5, and equivalent rules.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Cancel anytime.</span> You can cancel at any
            time, self-serve, through the same medium you used to subscribe — from Settings (which opens
            the Stripe customer portal). Cancellation stops future renewals from the end of the current
            billing period.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">No money-back guarantee.</span> Because we offer
            a no-card free trial so you can evaluate the service before paying, fees already billed are{" "}
            <span className="font-semibold text-ink-stage">non-refundable</span> except where a refund is
            required by applicable mandatory law. {RISK_REVERSAL.capLine}
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="Ownership" title="Intellectual property">
        <p>
          Bright Ears and its software, design and content are owned by Bright Ears Co., Ltd. You retain
          ownership of your business content (profile, packages, voice samples) and your leads&rsquo; data,
          and you grant us the rights needed to process that content to provide the service.
        </p>
      </LegalSection>

      <LegalSection kicker="The fine print" title="Disclaimers and limitation of liability">
        <p>
          To the fullest extent permitted by law, the service is provided{" "}
          <span className="font-semibold text-ink-stage">&ldquo;as is&rdquo;</span> and{" "}
          <span className="font-semibold text-ink-stage">&ldquo;as available&rdquo;</span>, without
          warranties of any kind. We do not warrant that the service will be uninterrupted or error-free,
          or that AI-generated content will be accurate.
        </p>
        <p>
          <span className="font-semibold text-ink-stage">Liability cap.</span> To the fullest extent
          permitted by law, our total aggregate liability arising out of or relating to the service in any
          12-month period is limited to the amount of fees you paid us in the 12 months before the event
          giving rise to the claim.
        </p>
        <p>
          <span className="font-semibold text-ink-stage">Excluded losses.</span> We are not liable for any
          indirect, incidental, special or consequential loss, or for lost profits, lost revenue, lost
          bookings, lost goodwill or lost data, however arising.
        </p>
        <p>
          <span className="font-semibold text-ink-stage">Carve-outs.</span> Nothing in these terms limits
          or excludes liability for fraud or fraudulent misrepresentation, for gross negligence or wilful
          misconduct, for death or personal injury caused by negligence, or for any liability that cannot
          lawfully be limited or excluded — including non-excludable consumer guarantees under the
          Australian Consumer Law, the UK Consumer Rights Act, or other mandatory consumer law where it
          applies. These limitations are intended to be reasonable and to operate only to the extent
          permitted by Thailand&rsquo;s Unfair Contract Terms Act and other applicable law; if any
          limitation is held unenforceable, it applies to the maximum extent that is enforceable.
        </p>
      </LegalSection>

      <LegalSection kicker="Ending it" title="Suspension and termination">
        <p>
          You may stop using the service at any time. We may suspend or terminate access if you breach
          these terms (including the Acceptable Use Policy) or use the service unlawfully. On termination,
          your data is handled per the Privacy Policy and the Data Processing Addendum.
        </p>
      </LegalSection>

      <LegalSection kicker="Changes & law" title="Changes, governing law and contact">
        <p>
          We may update these terms; material changes will be communicated, and continued use after the
          effective date constitutes acceptance.
        </p>
        <p>
          <span className="font-semibold text-ink-stage">Governing law and venue.</span> These terms are
          governed by the laws of <span className="font-semibold text-ink-stage">Thailand</span>, and the
          courts of Thailand have jurisdiction over disputes.{" "}
          <span className="font-semibold text-ink-stage">However</span>, where you deal with us as a
          consumer protected by mandatory law in your country of residence, that choice of law and venue
          does not deprive you of the protection of provisions that cannot be derogated from by agreement
          under that mandatory law (for example, Article 6 of the EU Rome I Regulation, the UK Consumer
          Rights Act, or the Australian Consumer Law), and you may have the right to bring proceedings in
          your local courts.
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
