import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Data Processing Addendum (draft) — Bright Ears",
  description:
    "Processor terms: how Bright Ears handles personal data on behalf of performer businesses (the controllers). Draft, pending legal review.",
  robots: { index: false, follow: true },
};

const CONTACT = "privacy@brightears.io";

export default function DpaPage() {
  return (
    <LegalPage
      kicker="Legal — DPA"
      title="Data Processing "
      gradientWord="Addendum"
      lead="When Bright Ears processes the personal data of your leads and clients, it does so as your processor. This addendum sets out those processor terms. It forms part of, and supplements, the Terms of Service."
    >
      <LegalSection kicker="Roles" title="Controller and processor">
        <p>
          For personal data relating to your leads, clients and outreach targets that is processed through
          Bright Ears (&ldquo;Customer Personal Data&rdquo;), you — the performer business — are the{" "}
          <span className="font-semibold text-ink-stage">controller</span> and Bright Ears is the{" "}
          <span className="font-semibold text-ink-stage">processor</span>. Bright Ears processes Customer
          Personal Data only on your documented instructions, including those given through your use and
          configuration of the service, except where required by law.
        </p>
        <p>
          This addendum is separate from how Bright Ears handles your own account data, where Bright Ears
          acts as controller — see the{" "}
          <Link href="/privacy" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection kicker="Scope" title="Subject matter, duration, nature and purpose">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">Subject matter:</span> processing of Customer
            Personal Data to provide the Bright Ears service.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Duration:</span> for the term of your
            subscription, plus the limited period needed to return or delete data afterwards.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Nature and purpose:</span> ingesting, parsing,
            triaging, storing, drafting replies to, sending, and following up on inquiries and outreach on
            your behalf.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Types of data:</span> names, email addresses,
            phone numbers, event details, message content, and publicly available business contact data for
            outreach.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Categories of data subjects:</span> your leads,
            clients, and the venue/organiser contacts you target with proactive outreach.
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="Our obligations" title="Bright Ears&rsquo; processor commitments">
        <ul className="list-disc space-y-2 pl-5">
          <li>Process Customer Personal Data only on your documented instructions.</li>
          <li>
            Ensure people authorised to process the data are bound by appropriate confidentiality
            obligations.
          </li>
          <li>Implement appropriate technical and organisational security measures.</li>
          <li>
            Assist you, taking into account the nature of processing, with responding to data subject
            requests and with your security, breach-notification and impact-assessment obligations.
          </li>
          <li>
            Notify you without undue delay after becoming aware of a personal data breach affecting Customer
            Personal Data.
          </li>
          <li>
            At the end of the service, delete or return Customer Personal Data at your choice, except where
            retention is required by law.
          </li>
          <li>
            Make available information needed to demonstrate compliance and allow for audits, subject to
            reasonable confidentiality and scheduling terms to be finalised in legal review.
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="Sub-processors" title="Authorised sub-processors">
        <p>
          You authorise Bright Ears to engage sub-processors to deliver the service. Current
          sub-processors are listed in the{" "}
          <Link href="/privacy" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Privacy Policy
          </Link>{" "}
          and include Postmark (email), OpenRouter (AI/LLM gateway), Render (hosting and database), Clerk
          (authentication), Stripe (billing), Serper (search), and Google (send-only mailbox access).
        </p>
        <p>
          Bright Ears imposes data-protection obligations on each sub-processor that are materially the same
          as those in this addendum, and remains responsible for their performance. We will give notice of
          changes to the sub-processor list so you can object on reasonable grounds.
        </p>
      </LegalSection>

      <LegalSection kicker="Transfers" title="International data transfers">
        <p>
          Where Customer Personal Data is transferred internationally (including to the United States), the
          transfer is made subject to appropriate safeguards such as the UK/EU Standard Contractual Clauses
          and the UK Addendum, or another lawful transfer mechanism.
        </p>
      </LegalSection>

      <LegalSection kicker="Data subjects" title="Assisting with requests and erasure">
        <p>
          Bright Ears will, taking into account the nature of the processing, assist you in fulfilling your
          obligation to respond to requests from data subjects to exercise their rights (access, correction,
          deletion, restriction, portability, objection). If a data subject contacts Bright Ears directly,
          we will route the request to you as controller. A described deletion/DSAR path is available via{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            {CONTACT}
          </a>
          ; automation of erasure is a planned follow-up.
        </p>
      </LegalSection>

      <LegalSection kicker="Contact" title="How to reach us">
        <p>
          Questions about this addendum, or to request a countersigned copy once it is finalised in legal
          review, can be sent to{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
