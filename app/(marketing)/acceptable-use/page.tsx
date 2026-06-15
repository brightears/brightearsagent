import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Acceptable Use & Anti-Spam Policy (draft) — Bright Ears",
  description:
    "Your responsibilities as the legal sender of outbound email through Bright Ears: per-jurisdiction anti-spam duties (CAN-SPAM, CASL, UK PECR, Australia Spam Act, GDPR/ePrivacy), suppression and opt-out rules, and platform bans. Draft, pending legal review.",
  robots: { index: false, follow: true },
};

const CONTACT = "privacy@brightears.io";

export default function AcceptableUsePage() {
  return (
    <LegalPage
      kicker="Legal — Acceptable Use"
      title="Acceptable Use & Anti-Spam "
      gradientWord="Policy"
      lead="Bright Ears gives you powerful outbound tooling. This policy sets out how you must use it. You are the legal sender of every message; these are the rules that keep that lawful, and breaking them can get you suspended."
    >
      <LegalSection kicker="The core principle" title="You are the sender and the responsible party">
        <p>
          For every message generated or sent through Bright Ears — whether via our Postmark
          infrastructure (<span className="font-mono text-[0.92em]">mail.brightears.io</span>) or from
          your own connected Google mailbox — <span className="font-semibold text-ink-stage">you are the
          legal sender and initiator</span>. You decide who is contacted and what is said. You are solely
          responsible for compliance with the laws below, and you indemnify Bright Ears for messages you
          send, as set out in the{" "}
          <Link href="/terms" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Terms of Service
          </Link>
          . Bright Ears applies a jurisdiction rules engine and automation hard-stops to help you stay
          compliant, but the legal duty is yours.
        </p>
      </LegalSection>

      <LegalSection kicker="By jurisdiction" title="Your anti-spam duties, country by country">
        <p>
          The rules that apply turn on where your <span className="font-semibold text-ink-stage">recipient</span>
          {" "}is, not where you are. In summary:
        </p>
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">United States — CAN-SPAM.</span> Use truthful,
            non-deceptive headers and subject lines, identify the message as a solicitation where relevant,
            include a valid physical postal address, and provide a clear opt-out that you honour within{" "}
            <span className="font-semibold text-ink-stage">10 business days</span>.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Canada — CASL.</span> Commercial email
            generally requires consent — including for B2B; implied consent for published business
            addresses is narrow and risky. Every message must identify the sender and carry a working
            unsubscribe. Bright Ears does not auto-send to Canadian recipients: it drafts, and you copy and
            send personally, owning the judgment call.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">United Kingdom — PECR / UK GDPR.</span> Email to
            a corporate subscriber (a company / corporate body) is opt-out based and lawful with sender
            identification and a working opt-out. Sole traders and individuals are treated as individual
            subscribers and generally require consent. Identify yourself in every message.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Australia — Spam Act 2003.</span> Inferred
            consent can apply to a conspicuously published business address relevant to the message. Keep
            the message strictly relevant to the recipient&rsquo;s business, identify yourself, and include
            a functional unsubscribe.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">EU — GDPR / ePrivacy.</span> You need a lawful
            basis to process the contact data and to send (legitimate interests for relevant B2B outreach,
            where it holds; consent where required). Practise data minimisation on scraped contacts and
            honour objections immediately. Some member states (e.g. Germany, Austria) require prior
            consent even for B2B — Bright Ears will not auto-send to those and you must send personally if
            at all.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Anywhere else.</span> Bright Ears fails closed:
            if we have not researched a country&rsquo;s cold-email rules, the agent will not auto-send
            there — it drafts only, and you decide whether to send.
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="Always" title="Operational duties that apply everywhere">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">Maintain and honour the suppression list.</span>{" "}
            Anyone who opts out, asks to stop, or sends a cease-and-desist goes on your suppression list and
            must never be contacted again. Do not re-import or work around suppressed contacts.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Never disable identification or opt-out.</span>{" "}
            Every message must identify you and offer a way to stop. You may not strip, hide or disable the
            sender-identification or opt-out elements that Bright Ears appends.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Respect the automation hard-stops.</span> An
            opt-out, a reply from the recipient, or a status of BOOKED or DEAD immediately stops any
            sequence to that contact. You may not re-trigger a stopped sequence to circumvent this.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Send only relevant, honest, B2B outreach.</span>{" "}
            No deceptive content, no harvesting beyond what the tool gathers, no high-volume blasting. Keep
            within the daily caps the product enforces.
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="Platform rules" title="Lead-source and platform bans">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">The Knot / WeddingWire.</span> Never script,
            automate or scrape their vendor inboxes or messaging systems. (Parsing their notification
            emails that arrive in your own inbox is fine — that is your own mail.)
          </li>
          <li>
            <span className="font-semibold text-ink-stage">GigSalad.</span> Draft and deep-link only —
            Bright Ears prepares the message and links you into GigSalad to send it yourself. Never
            auto-send into GigSalad.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Respect every platform&rsquo;s terms.</span> Do
            not use Bright Ears to breach the terms of any third-party platform or to automate against a
            platform that prohibits it.
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="Enforcement" title="What happens if you break these rules">
        <p>
          Breach of this policy is a breach of the Terms of Service. We may pause sending, suspend
          features, or terminate your account, and you remain responsible (and indemnify us) for any
          messages you sent in breach. Questions, or to report misuse, email{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
