import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalSection, ToBeCompleted } from "@/components/legal-page";

export const metadata: Metadata = {
  title: "Privacy Policy (draft) — Bright Ears",
  description:
    "How Bright Ears Co., Ltd. (Thailand) handles personal data across the PDPA, GDPR, UK GDPR, CCPA/CPRA and other regimes. Draft, pending legal review. Three roles: controller for account data, processor for performers' leads, and controller for scraped venue contacts.",
  robots: { index: false, follow: true },
};

const CONTACT = "privacy@brightears.io";

export default function PrivacyPage() {
  return (
    <LegalPage
      kicker="Legal — Privacy"
      title="Privacy "
      gradientWord="Policy"
      lead="This explains what personal data Bright Ears collects, why, the legal bases we rely on in each jurisdiction, who helps us process it, how long we keep it, and how you — or anyone whose data we hold — can see, correct, object to or delete it."
    >
      <LegalSection kicker="Who we are" title="Bright Ears Co., Ltd., a Thailand-registered controller">
        <p>
          Bright Ears is an AI back office for wedding and event performer businesses. The contracting
          entity and data controller for this service is{" "}
          <span className="font-semibold text-ink-stage">Bright Ears Co., Ltd.</span>, a company
          registered in Thailand (registration number{" "}
          0105550096659, registered office{" "}
          {/* TODO(founder): registered office address in Thailand */}
          <ToBeCompleted label="registered address" />). References to &ldquo;Bright Ears&rdquo;,
          &ldquo;we&rdquo;, &ldquo;us&rdquo; and &ldquo;our&rdquo; mean that entity.
        </p>
        <p>
          Our <span className="font-semibold text-ink-stage">home data-protection regime is Thailand&rsquo;s
          Personal Data Protection Act (PDPA)</span>. Because Bright Ears Co., Ltd. is established in
          Thailand, the company is its own local presence under the PDPA. We also comply with the other
          regimes that apply to the people whose data we handle — the EU and UK GDPR, the California
          Consumer Privacy Act as amended by the CPRA, and equivalent laws in Canada, Australia and
          elsewhere — as set out below.
        </p>
      </LegalSection>

      <LegalSection kicker="The short version" title="The three roles we play">
        <p>
          Privacy law assigns responsibility by role. Bright Ears sits in three roles depending on the
          data, and it is worth being precise about which is which:
        </p>
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">Your account data — we are the controller.</span>{" "}
            The information you give us to run your subscription. This policy governs that data.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">
              Your leads&rsquo; and end-clients&rsquo; data — you are the controller, we are the processor.
            </span>{" "}
            The inquiries and conversations that flow through the product. You (the performer business)
            decide the purposes; we handle that data only on your instructions, under the{" "}
            <Link href="/dpa" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
              Data Processing Addendum
            </Link>
            . This privacy policy does not govern that data — the DPA does.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">
              Scraped venue and contact data for the proactive Hunt — we are the controller.
            </span>{" "}
            When our venue-finding agent gathers publicly available business contact information about
            venues and event organisers, Bright Ears determines the purpose (helping our customers reach
            relevant venues) and is therefore the controller for that data. We carry our own lawful
            basis, our own transparency duty and our own deletion path for it — all set out below.
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="What we collect" title="The data we hold, and why">
        <p>We collect the following categories of personal data:</p>
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">Account data (we are controller).</span>{" "}
            Your name, email, business name, authentication credentials (via Clerk), billing details
            (held by Stripe — we do not store full card numbers), business profile, packages and rate
            card, voice samples, gig calendar and timezone, and your contact preferences. We use this to
            provide and bill the service.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">
              Leads&rsquo; contact details and inquiry content (you are controller; we process).
            </span>{" "}
            Names, email addresses, phone numbers, event dates, venues and the free-text content of the
            inquiries and conversations that arrive at your forwarding address. We process this to parse,
            triage, draft replies, send messages on your behalf and run follow-up sequences.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">
              Scraped venue and contact details (we are controller).
            </span>{" "}
            Where you enable the proactive Hunt, we gather publicly available business contact
            information about venues and event organisers — business names, public business email
            addresses (found on the venue&rsquo;s own website or in public listings), websites, and the
            occasional named events/booking contact where a public source states one. We do not collect
            names from LinkedIn (we store only a profile link for the owner to use). See the
            indirect-collection notice below.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Usage logs and AI/LLM cost records.</span>{" "}
            Technical logs of how the product is used, and records of our processing cost per account.
            Our usage-cost table stores token counts only (no message content). The prompts and
            completions themselves transit our AI gateway (OpenRouter) to generate parses, triage
            decisions and drafts, and may contain the lead/inquiry or scraped content above; they are
            retained only transiently for that purpose (see Retention).
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Mailbox-send authorisation (optional).</span>{" "}
            If you connect your own Google mailbox so the Hunt can send from it, we use a minimal-scope,
            send-only authorisation (<span className="font-mono text-[0.92em]">gmail.send</span>). We do
            not read your inbox; the token is stored encrypted.
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="Legal bases" title="The legal grounds we rely on, by regime">
        <p>
          The applicable basis depends on both the data and the law that applies to the person. For
          identified bases under the GDPR (EU/UK), the PDPA and equivalents:
        </p>
        <ul className="list-disc space-y-3 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">Performance of a contract.</span> Processing
            your account data to deliver the service and take payment (PDPA s.24(3); GDPR Art 6(1)(b)).
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Legitimate interests.</span> Securing the
            service, debugging, fraud prevention, and measuring AI quality and cost (GDPR Art 6(1)(f);
            PDPA s.24(5)). And — for the proactive Hunt — processing publicly available business contact
            data to send relevant B2B outreach about our customers&rsquo; services. We have carried out a{" "}
            <span className="font-semibold text-ink-stage">documented Legitimate Interest Assessment
            (LIA)</span> for that scraped-contact cold outreach, weighing our and our customers&rsquo;
            interest in reaching relevant venues against each recipient&rsquo;s rights and reasonable
            expectations, and we always honour an objection or opt-out (see below). You may request a
            summary of the LIA at{" "}
            <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
              {CONTACT}
            </a>
            .
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Consent.</span> Where a regime requires prior
            consent for a given activity (for example, cold email to recipients in jurisdictions such as
            Germany, Austria or Canada under our outreach rules), we either obtain it or do not carry out
            that activity automatically.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Legal obligation.</span> Where we must keep
            records (e.g. tax, accounting) or respond to lawful requests (GDPR Art 6(1)(c); PDPA s.24(6)).
          </li>
          <li>
            <span className="font-semibold text-ink-stage">
              Processor instructions / your legal basis.
            </span>{" "}
            For your leads&rsquo; data, we process on your documented instructions; you, as controller,
            are responsible for the lawful basis (see the DPA).
          </li>
        </ul>
      </LegalSection>

      <LegalSection
        kicker="Indirect collection"
        title="Notice to people whose details we scraped (GDPR Art 14 / PDPA)"
      >
        <p>
          If you are an individual at a venue or event business and we have collected your business
          contact details from a public source rather than from you directly, this notice applies to you.
          It is the transparency information required by Article 14 of the GDPR and the equivalent PDPA
          duty for indirectly-collected data.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">Who holds your data:</span> Bright Ears Co.,
            Ltd. (Thailand), as controller. Contact{" "}
            <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
              {CONTACT}
            </a>
            .
          </li>
          <li>
            <span className="font-semibold text-ink-stage">What we hold:</span> your business name and
            role where stated, a public business email address, your venue&rsquo;s website, and short
            factual notes drawn from public sources (e.g. that the venue runs DJ nights).
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Source:</span> publicly accessible web pages —
            the venue&rsquo;s own website, public business listings, and press coverage — located via a
            search API. We only store an email address that literally appears on a page we fetched; we
            never guess or generate one.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Why and on what basis:</span> to introduce a
            relevant performer&rsquo;s services to your venue (B2B outreach), relying on our legitimate
            interests backed by the LIA above.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">How long:</span> see the retention periods
            below; scraped contacts are reviewed and purged on the schedule there, and immediately on a
            valid objection.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Your rights:</span> access, rectification,
            erasure, restriction, and — importantly — an{" "}
            <span className="font-semibold text-ink-stage">absolute right to object to direct
            marketing</span>. You can object or opt out in one step: reply to any outreach message and
            tell us, or email{" "}
            <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
              {CONTACT}
            </a>
            . We will stop and add you to our suppression list.
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="Cold outreach" title="The proactive Hunt, and your right to object / opt out">
        <p>
          Where a customer enables the Hunt, Bright Ears drafts and (with the customer&rsquo;s approval,
          or via per-source automation they set) sends B2B pitches to venues and organisers using the
          publicly available business contact data above, relying on legitimate interests and the
          applicable electronic-marketing rules. Sending is governed by our per-recipient jurisdiction
          rules and our{" "}
          <Link href="/acceptable-use" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Acceptable Use &amp; Anti-Spam Policy
          </Link>
          .
        </p>
        <p>
          Anyone who receives this outreach can object to, or opt out of, further messages at any time —
          the right to object to direct marketing is absolute. Every outreach message identifies the
          sender and carries a clear opt-out, and a reply, a booking, a &ldquo;dead&rdquo; status or an
          opt-out hard-stops the sequence immediately. To opt out of all Bright Ears outreach across all
          customers, email{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            {CONTACT}
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection kicker="California" title="Your CCPA / CPRA rights (California residents)">
        <p>
          For California residents, this is our notice at collection and our statement of practices under
          the California Consumer Privacy Act, as amended by the CPRA.
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">
              We do NOT sell or share your personal information
            </span>{" "}
            — not for money and not for cross-context behavioural advertising. Because we do not sell or
            share, we do not offer a &ldquo;Do Not Sell or Share My Personal Information&rdquo; link
            (one would falsely imply a sale takes place). We still honour browser{" "}
            <span className="font-semibold text-ink-stage">Global Privacy Control (GPC)</span> signals as
            an opt-out where applicable.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Categories collected and purposes</span> are
            described in &ldquo;What we collect&rdquo; above; this serves as the notice at collection.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Your rights:</span> to know, access, correct,
            delete, and to limit use of sensitive personal information, with no discrimination for
            exercising them. To make a request, email{" "}
            <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
              {CONTACT}
            </a>
            .
          </li>
          <li>
            At our current scale Bright Ears is{" "}
            <span className="font-semibold text-ink-stage">below the CCPA business thresholds</span>, so
            many CCPA obligations do not yet apply to us — but we follow the practices above regardless.
            We will update this section if our scale crosses those thresholds.
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="Representatives" title="Our EU and UK representatives">
        <p>
          Because Bright Ears is established in Thailand but targets data subjects in the EU and the UK,
          we are required to appoint local Article 27 representatives. We have appointed:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">EU representative (GDPR Art 27):</span>{" "}
            {/* TODO(founder): appoint an EU Art 27 representative and insert name + EU address + contact */}
            <ToBeCompleted label="EU representative — to appoint" />.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">UK representative (UK GDPR Art 27):</span>{" "}
            {/* TODO(founder): appoint a UK Art 27 representative and insert name + UK address + contact.
                This duty survived the UK Data (Use and Access) Act 2025 and still applies. */}
            <ToBeCompleted label="UK representative — to appoint" />.
          </li>
        </ul>
        <p>
          EU and UK data subjects may contact the relevant representative on any matter relating to our
          processing of their data. We have{" "}
          {/* TODO(founder): decide whether a Data Protection Officer is required/appointed; if so, insert
              DPO name + contact. Most likely NOT mandatory at current scale (no large-scale special-category
              or systematic monitoring), but confirm in legal review. */}
          <ToBeCompleted label="DPO decision — to confirm" /> regarding a Data Protection Officer; at our
          current scale a DPO is not expected to be mandatory, and privacy queries are handled by the
          contact below.
        </p>
      </LegalSection>

      <LegalSection kicker="Who helps us" title="Sub-processors and service providers">
        <p>
          We use the following service providers to operate Bright Ears. Each handles personal data only
          as needed to provide its service to us, under contract:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">Postmark</span> — transactional and
            outbound/inbound email delivery for the reactive product.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">OpenRouter</span> — AI/LLM gateway that routes
            prompts to language models for parsing, triage and drafting.
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
            processing (Stripe-hosted checkout and customer portal).
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Serper / Google Search</span> — search API used
            to find publicly available venue/contact information for the Hunt.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Google (Gmail API, OAuth)</span> — send-only
            access to your own mailbox, where you connect one for the Hunt.
          </li>
        </ul>
        <p>
          We keep this list current. If we add a sub-processor that materially changes how data is
          handled, we will update this page. The full processor-side terms, change-notice and objection
          rights are in the{" "}
          <Link href="/dpa" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Data Processing Addendum
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection kicker="Where data goes" title="International transfers from Thailand">
        <p>
          Several of our providers process data outside Thailand, including in the United States and the
          EU. Thailand&rsquo;s PDPC has not published an adequacy whitelist of approved destination
          countries, so we do not rely on adequacy. Instead, every cross-border transfer is made under
          appropriate safeguards — primarily the{" "}
          <span className="font-semibold text-ink-stage">Standard Contractual Clauses</span> (with the UK
          Addendum where UK data is involved) together with each provider&rsquo;s own transfer
          mechanism. You can ask us for detail on the safeguards in place for a given provider.
        </p>
      </LegalSection>

      <LegalSection kicker="How long" title="Retention periods">
        <p>We keep personal data only as long as needed for the purpose it was collected for:</p>
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <span className="font-semibold text-ink-stage">Account data:</span> for the life of your
            account, then deleted or anonymised within 90 days of account closure, except records we must
            keep for tax/accounting law (retained for the statutory period, typically up to 5–7 years,
            then deleted).
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Leads&rsquo; / end-client data:</span> retained
            per your instructions and the DPA for the term of your subscription, then deleted or returned
            at your choice; on account closure, deleted or anonymised within 90 days unless you ask for
            an export first.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">AI/LLM prompt &amp; completion content:</span>{" "}
            not stored in our database. It transits the gateway only to produce the result and is held
            transiently; our gateway&rsquo;s logs are configured for a short retention window (target
            ≤30 days) after which they are purged. Our own usage-cost table stores token counts only —
            no message content.
          </li>
          <li>
            <span className="font-semibold text-ink-stage">Scraped venue/contact data:</span> retained
            only while a contact remains a live prospect; reviewed and purged when stale (target: removed
            within 12 months of last activity), and deleted promptly on a valid objection or opt-out.
            Opt-out/suppression records are kept (minimal: an email and a reason) for as long as needed to
            keep honouring the opt-out.
          </li>
        </ul>
      </LegalSection>

      <LegalSection kicker="Your rights" title="Access, correction, deletion and how to request (DSAR path)">
        <p>
          Depending on where you live, you may have the right to access, correct, delete, port, restrict
          or object to the processing of your personal data, to withdraw consent, and (for scraped
          contacts) an absolute right to object to direct marketing. To exercise any of these — including
          a data subject access request (DSAR) or an erasure request — email{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            {CONTACT}
          </a>
          . We respond within the timeframe required by applicable law (for example, 30 days under the
          GDPR/UK GDPR, extendable where permitted; without undue delay under the PDPA). We may need to
          verify your identity first.
        </p>
        <p>
          If your data was given to a performer business that uses Bright Ears (i.e. you are their lead or
          client), that business is the controller; we will route your request to them and assist them as
          their processor. For data where Bright Ears is the controller — your account data and scraped
          venue contacts — we action the request directly.
        </p>
      </LegalSection>

      <LegalSection kicker="If something goes wrong" title="Data breaches">
        <p>
          If a personal data breach occurs that is likely to result in a risk to people&rsquo;s rights, we
          will notify the relevant authority within{" "}
          <span className="font-semibold text-ink-stage">72 hours</span> of becoming aware of it — the
          Thai PDPC under the PDPA, and the competent GDPR supervisory authority where EU/UK data subjects
          are affected — and will inform affected individuals where the law requires. As a processor for
          your leads&rsquo; data, we notify you without undue delay so you can meet your own obligations.
        </p>
      </LegalSection>

      <LegalSection kicker="Cookies" title="Cookies and similar technologies">
        <p>
          Bright Ears uses strictly-necessary cookies only — primarily authentication/session cookies set
          by Clerk and security cookies (e.g. CSRF protection). We do not use advertising or cross-site
          tracking cookies, and our payment and checkout pages are Stripe-hosted (their cookies are set on
          Stripe&rsquo;s domain, not ours). See the{" "}
          <Link href="/cookies" className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            Cookie Policy
          </Link>{" "}
          for the per-cookie detail.
        </p>
      </LegalSection>

      <LegalSection kicker="Contact" title="How to reach us">
        <p>
          Questions about this policy, or about how your data is handled, can be sent to{" "}
          <a href={`mailto:${CONTACT}`} className="font-semibold text-ink-stage underline decoration-ink-stage/30 underline-offset-2 hover:decoration-ink-stage">
            {CONTACT}
          </a>
          , or by post to Bright Ears Co., Ltd.,{" "}
          {/* TODO(founder): registered office address in Thailand */}
          <ToBeCompleted label="registered address" />. EU and UK data subjects may also contact our
          respective representatives named above. You also have the right to lodge a complaint with the
          Thai PDPC or your local supervisory authority.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
