import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy (draft) — Bright Ears",
  description:
    "How Bright Ears handles personal data. Draft, pending legal review. Bright Ears is the AI back office for performer businesses; the performer is the data controller for their leads, and Bright Ears acts as the processor.",
  robots: { index: false, follow: true },
};

const CONTACT = "privacy@brightears.io";

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Legal — Privacy"
      title="Privacy "
      gradientWord="Policy"
      lead="This explains what personal data Bright Ears collects, why, the legal bases we rely on, who helps us process it, and how you (or anyone whose data we hold) can ask to see, correct or delete it."
    >
      <LegalSection kicker="The short version" title="Who we are, and the two roles we play">
        <p>
          Bright Ears is an AI back office for wedding and event performer businesses. We ingest the
          inquiries your business receives, triage spam, draft replies in your voice, and follow up
          until a gig is booked or the lead goes cold. A separate proactive feature can also reach
          out to venues on your behalf.
        </p>
        <p>
          Privacy law splits responsibility into two roles, and Bright Ears sits in both depending on
          the data:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">For your own account data</span> (the
            information you give us to run your subscription), Bright Ears is the{" "}
            <span className="font-semibold text-ink-stage">controller</span>. This policy governs that
            data.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">
              For your leads&rsquo; and clients&rsquo; personal data
            </span>{" "}
            that flows through the product, <span className="font-semibold text-ink-stage">you</span>{" "}
            (the performer business) are the controller and{" "}
            <span className="font-semibold text-ink-stage">Bright Ears is the processor</span>. We
            handle that data only on your instructions, under the{" "}
            <Link href="/dpa" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
              Data Processing Addendum
            </Link>
            .
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="What we collect" title="The data we hold, and why">
        <p>We collect the following categories of personal data:</p>
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">Account data (we are controller).</span>{" "}
            Your name, email, business name, password/authentication credentials (via Clerk), billing
            details (via Stripe), business profile, packages and rate card, voice samples, gig
            calendar and timezone, and your contact preferences. We use this to provide and bill the
            service.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">
              Leads&rsquo; contact details and inquiry content (you are controller; we process).
            </span>{" "}
            Names, email addresses, phone numbers, event dates, venues and the free-text content of
            the inquiries and conversations that arrive at your forwarding address. We process this to
            parse, triage, draft replies, send messages on your behalf and run follow-up sequences.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">
              Scraped venue and contact details for proactive outreach.
            </span>{" "}
            Where you enable the proactive sales agent, we collect publicly available business contact
            information about venues and event organisers (business names, public email addresses,
            websites, public listings) gathered via search, so the agent can draft and send cold
            outreach pitching your services. See the section on outreach and your right to object
            below.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Usage and AI/LLM logs.</span> Technical
            logs of how the product is used, and records of the prompts and completions sent to our AI
            model gateway (so we can measure quality, debug, and track our processing cost per
            account). These may contain the lead/inquiry content described above.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Mailbox-send authorisation (optional).</span>{" "}
            If you connect your own Google mailbox so the proactive agent can send from it, we use a
            minimal-scope authorisation (send-only). We do not read your inbox.
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="Legal bases" title="The legal grounds we rely on (UK/EU GDPR)">
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">Contract.</span> Processing your account
            data to deliver the service and take payment.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Legitimate interests.</span> For securing
            the service, debugging, fraud prevention, measuring AI quality and cost, and — for the
            proactive agent — processing publicly available business contact data to send relevant
            B2B outreach about your services. We balance this against the recipient&rsquo;s rights and
            always honour an objection or opt-out (see below).
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Legal obligation.</span> Where we must keep
            records (e.g. tax, accounting) or respond to lawful requests.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">
              Processor instructions / your legal basis.
            </span>{" "}
            For your leads&rsquo; data, we process on your documented instructions. You, as
            controller, are responsible for having a valid legal basis for that data.
          </li>
        </ul>
        <p>
          Where electronic marketing is regulated by the UK/EU Privacy and Electronic Communications
          Regulations (PECR) — and equivalents elsewhere — outreach follows the applicable rules,
          targets corporate/business contacts, identifies the sender, and offers a clear opt-out in
          every message.
        </p>
      </LegalSection>

      <LegalSection kicker="Cold outreach" title="The proactive agent, and your right to object / opt out">
        <p>
          Where you enable proactive outreach, Bright Ears drafts and (with your approval, or via
          per-source automation you set) sends B2B pitches to venues and organisers using publicly
          available business contact data, relying on legitimate interests under GDPR and the
          applicable electronic-marketing rules under PECR.
        </p>
        <p>
          Anyone who receives this outreach can object to or opt out of further messages at any time.
          Every outreach email carries a clear opt-out, and a reply, a booking, a &ldquo;dead&rdquo;
          status or an opt-out hard-stops the sequence immediately. To opt out of all Bright Ears
          outreach across customers, email{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection kicker="Who helps us" title="Sub-processors">
        <p>
          We use the following service providers to operate Bright Ears. Each handles personal data
          only as needed to provide its service to us, under contract:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">Postmark</span> — transactional and
            outbound/inbound email delivery.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">OpenRouter</span> — AI/LLM gateway that
            routes prompts to language models for parsing, triage and drafting.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Render</span> — application hosting and
            managed PostgreSQL database.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Clerk</span> — authentication and session
            management.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Stripe</span> — subscription billing and
            payment processing.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Serper</span> — search API used to find
            publicly available venue/contact information for the proactive agent.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Google (OAuth)</span> — send-only access to
            your own mailbox, where you connect one for proactive outreach.
          </li>
        </ul>
        <p>
          We will keep this list current as the product evolves. If we add a sub-processor that
          materially changes how data is handled, we will update this page.
        </p>
      </LegalSection>

      <LegalSection kicker="Where data goes" title="International transfers">
        <p>
          Some of our providers process data outside your country, including in the United States. Where
          personal data is transferred internationally, we rely on appropriate safeguards such as the
          UK/EU Standard Contractual Clauses (and the UK Addendum) and the providers&rsquo; own
          transfer mechanisms. You can ask us for more detail on the safeguards in place.
        </p>
      </LegalSection>

      <LegalSection kicker="How long" title="Retention">
        <p>
          We keep account data for as long as your account is active and for a reasonable period
          afterwards to meet legal, tax and accounting obligations, then delete or anonymise it. Leads&rsquo;
          data is retained per your instructions and our Data Processing Addendum, and is deleted or
          returned at the end of the engagement. AI/LLM logs are kept only as long as needed for
          quality, debugging and cost measurement, then deleted or anonymised. We will publish specific
          retention periods as they are finalised in legal review.
        </p>
      </LegalSection>

      <LegalSection kicker="Your rights" title="Access, correction and deletion (DSAR path)">
        <p>
          Depending on your location, you may have the right to access, correct, delete, port, restrict
          or object to the processing of your personal data, and to withdraw consent. To exercise any of
          these rights — including a data subject access request (DSAR) or an erasure request — email{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            {CONTACT}
          </a>
          . We will respond within the timeframe required by applicable law.
        </p>
        <p>
          If your data was given to a performer business that uses Bright Ears (i.e. you are a lead or
          client), that business is the controller; we will route your request to them and assist them as
          their processor. You may also contact us directly and we will help.
        </p>
      </LegalSection>

      <LegalSection kicker="Cookies" title="Cookies and similar technologies">
        <p>
          Bright Ears uses essential cookies only — primarily authentication and session cookies set by
          Clerk so you can stay signed in securely. We do not use advertising or cross-site tracking
          cookies. See the{" "}
          <Link href="/cookies" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Cookie Policy
          </Link>{" "}
          for details.
        </p>
      </LegalSection>

      <LegalSection kicker="Contact" title="How to reach us">
        <p>
          Questions about this policy, or about how your data is handled, can be sent to{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
