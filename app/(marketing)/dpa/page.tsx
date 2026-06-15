import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, ToBeCompleted } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Data Processing Addendum (draft) — Bright Ears",
  description:
    "Processor terms under GDPR Art 28(3) and Thailand PDPA s.40: how Bright Ears Co., Ltd. processes the personal data of a performer business's leads and end-clients, on that business's instructions. Draft, pending legal review.",
  robots: { index: false, follow: true },
};

const CONTACT = "privacy@brightears.io";

export default function DpaPage() {
  return (
    <LegalPage
      kicker="Legal — DPA"
      title="Data Processing "
      gradientWord="Addendum"
      lead="When Bright Ears processes the personal data of your leads and end-clients, it does so as your processor. This addendum sets out those processor terms, in the form required by GDPR Article 28(3) and Thailand PDPA section 40. It forms part of, and supplements, the Terms of Service."
    >
      <LegalSection kicker="Parties" title="Who this is between">
        <p>
          This Data Processing Addendum (&ldquo;DPA&rdquo;) is between you, the performer business that
          subscribes to Bright Ears (the &ldquo;Controller&rdquo;), and{" "}
          <span className="font-semibold text-ink-stage">Bright Ears Co., Ltd.</span>, a company
          registered in Thailand (registration number{" "}
          {/* TODO(founder): Thai company registration number */}
          <ToBeCompleted label="registration no." />, registered office{" "}
          {/* TODO(founder): registered office address in Thailand */}
          <ToBeCompleted label="registered address" />) (the &ldquo;Processor&rdquo;). It is incorporated
          into the{" "}
          <Link href="/terms" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection kicker="Scope" title="What this DPA covers — and what it does NOT">
        <p>
          This DPA applies <span className="font-semibold text-ink-stage">only</span> to the personal data
          of your leads and end-clients that you process through Bright Ears (&ldquo;Customer Personal
          Data&rdquo;) — the inquiries, contact details and conversation content that arrive at your
          forwarding address and flow through the product. For that data you are the controller and Bright
          Ears is the processor.
        </p>
        <p>
          This DPA does <span className="font-semibold text-ink-stage">not</span> cover the scraped venue
          and event-organiser contact data gathered by the proactive Hunt. For that data, Bright Ears is
          an <span className="font-semibold text-ink-stage">independent controller</span> with its own
          lawful basis, transparency duty and deletion path — not your processor. That processing is
          described in the{" "}
          <Link href="/privacy" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Privacy Policy
          </Link>
          . Nor does it cover your own account data, for which Bright Ears is the controller (also the
          Privacy Policy).
        </p>
      </LegalSection>

      <LegalSection
        kicker="Mandatory particulars"
        title="Subject-matter, duration, nature, purpose, data and subjects (Art 28(3) / s.40)"
      >
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">Subject-matter:</span> processing of Customer
            Personal Data to provide the Bright Ears service to you.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Duration:</span> for the term of your
            subscription, plus the limited period needed to return or delete the data afterwards.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Nature of the processing:</span> receiving,
            parsing, triaging, storing, drafting replies to, sending, and following up on inquiries and
            conversations on your behalf, including AI-assisted drafting.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Purpose:</span> enabling you to respond to and
            convert inquiries from your leads and end-clients.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Types of personal data:</span> names, email
            addresses, phone numbers, event dates and details, venue references, and the free-text content
            of inquiries and conversations.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Categories of data subjects:</span> your leads
            and your end-clients (the people enquiring about, or booking, your services).
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="Our obligations" title="Bright Ears&rsquo; processor commitments">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            Process Customer Personal Data only on your{" "}
            <span className="font-semibold text-ink-stage">documented instructions</span>, including those
            given through your use and configuration of the service, except where required by law (in which
            case we will inform you, unless legally prohibited).
          </li>
          <li>
            Ensure persons authorised to process the data are bound by an appropriate duty of{" "}
            <span className="font-semibold text-ink-stage">confidentiality</span>.
          </li>
          <li>
            Implement appropriate <span className="font-semibold text-ink-stage">technical and
            organisational security measures</span> (GDPR Art 32) — including encryption of secrets and
            stored mailbox tokens, access controls, tenant isolation, and protections against
            header-injection on outbound mail.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Assist you</span>, taking into account the
            nature of the processing, with responding to data-subject requests, and with your security,
            breach-notification and data-protection-impact-assessment obligations.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Notify you without undue delay</span> after
            becoming aware of a personal data breach affecting Customer Personal Data, with the
            information you need to meet your own notification duties.
          </li>
          <li>
            At the end of the service, <span className="font-semibold text-ink-stage">delete or return</span>{" "}
            Customer Personal Data at your choice, and delete existing copies, except where retention is
            required by law.
          </li>
          <li>
            Make available the information needed to demonstrate compliance and{" "}
            <span className="font-semibold text-ink-stage">allow for and contribute to audits</span>,
            including inspections, conducted by you or an auditor you mandate, subject to reasonable
            confidentiality, notice and scheduling terms.
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="Sub-processors" title="Authorised sub-processors">
        <p>
          You give <span className="font-semibold text-ink-stage">general authorisation</span> for Bright
          Ears to engage the sub-processors below to deliver the service. Each is bound by
          data-protection obligations materially the same as those in this DPA, and Bright Ears remains
          responsible for their performance.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">Postmark</span> — outbound/inbound email
            delivery.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">OpenRouter</span> — AI/LLM gateway for parsing,
            triage and drafting.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Render</span> — application hosting and managed
            PostgreSQL database.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Clerk</span> — authentication and session
            management.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Stripe</span> — subscription billing and payment
            processing.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Serper / Google Search</span> — search API
            (used chiefly for the Hunt; listed for completeness).
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Google (Gmail API)</span> — send-only mailbox
            access where you connect your own mailbox.
          </li>
        </ul>
        <p>
          We will give you reasonable advance notice of any intended addition or replacement of a
          sub-processor (a <span className="font-semibold text-ink-stage">change-notice</span>), and you
          may <span className="font-semibold text-ink-stage">object</span> on reasonable
          data-protection grounds; if we cannot resolve your objection, you may terminate the affected
          part of the service.
        </p>
      </LegalSection>

      <LegalSection kicker="Transfers" title="International data transfers">
        <p>
          Where Customer Personal Data is transferred outside Thailand or outside the EEA/UK (including to
          the United States), the transfer is made subject to an appropriate transfer mechanism —
          primarily the <span className="font-semibold text-ink-stage">Standard Contractual Clauses</span>{" "}
          and, for UK data, the <span className="font-semibold text-ink-stage">UK International Data
          Transfer Addendum</span>, together with the relevant sub-processor&rsquo;s own safeguards. No
          PDPC adequacy whitelist is relied upon.
        </p>
      </LegalSection>

      <LegalSection kicker="Data subjects" title="Assisting with requests, erasure and breaches">
        <p>
          Taking into account the nature of the processing, Bright Ears will assist you in fulfilling your
          obligation to respond to requests from data subjects exercising their rights (access,
          rectification, erasure, restriction, portability, objection). If a data subject contacts Bright
          Ears directly about Customer Personal Data, we will route the request to you as controller. A
          described deletion/DSAR path is available via{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            {CONTACT}
          </a>
          ; further automation of erasure is a planned follow-up.
        </p>
      </LegalSection>

      <LegalSection kicker="Liability & contact" title="Liability, order of precedence, and how to reach us">
        <p>
          Each party&rsquo;s liability under this DPA is subject to the limitations and exclusions in the{" "}
          <Link href="/terms" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Terms of Service
          </Link>
          . If there is a conflict between this DPA and the Terms of Service on the subject of data
          protection, this DPA prevails. To request a countersigned copy once finalised in legal review,
          or for any question about this addendum, email{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
