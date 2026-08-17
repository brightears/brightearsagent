# Hunt Legitimate Interest Assessment

- Status: **approved for controlled launch, subject to the restrictions below**
- Controller: Bright Ears Co., Ltd. (Head Office)
- Assessment date: 2026-08-17
- Owner/reviewer: Norbert Platzer, founder
- Next scheduled review: 2027-08-17 (or earlier on a trigger below)

This assessment covers Bright Ears' collection of public venue/business-contact
data for Hunt and the use of that data to prepare and, where separately lawful,
send targeted performer-to-venue outreach. It does not itself establish that an
email may be sent in any country. Electronic-marketing rules, recipient type and
jurisdiction must be checked separately.

The assessment follows the purpose, necessity and balancing tests described by
the [UK Information Commissioner's Office](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/a-guide-to-lawful-basis/legitimate-interests/).
The legal provisions relevant to the analysis include GDPR Article 6(1)(f),
Articles 14 and 21 in the [official EUR-Lex text](https://eur-lex.europa.eu/eli/reg/2016/679/ojv),
and Thailand PDPA sections 22, 24(5), 25 and 32 in the Department of Lands'
[English Act text](https://www.dol.go.th/media/813280155698073600/2026/01/5TMF1n9au27Gqoxmf4e8JXZL.pdf).

## Processing assessed

Hunt uses public search results and fetched public venue pages to identify a
venue that appears to buy entertainment, assess whether it is relevant to an
artist's location/style/fee profile, locate a published booking/events email,
draft a grounded one-to-one introduction, and retain enough data to avoid
recontacting someone who objects.

Data is limited to venue/business identity, city/country/type, public website or
social link, public business email, a named booking/events contact only when a
public source states one, source URL, short factual venue signals, fit/timing
scores, pitch/reply history and a minimal suppression record. It is intended for
adults acting in a business capacity. Special-category data, personal social
profiles, phone lists, private/gated sources and guessed email addresses are out
of scope.

## 1. Purpose test

The interests pursued are:

- helping a performer business find relevant venues that may buy its services;
- helping a venue discover a performer relevant to its publicly visible events
  programme or near-term opening/activity;
- making outreach selective and evidence-based instead of a broad untargeted
  list; and
- operating and measuring the contracted Hunt product while preventing repeat
  contact after an objection.

These are genuine commercial interests of Bright Ears and its customers and
can also benefit a recipient where the introduction is relevant. They are not
interests in selling the contact data, building a general people database or
profiling private behaviour. The purpose test is provisionally met.

## 2. Necessity test

A business contact and limited venue context are needed to make the specific
introduction. Waiting for an inbound inquiry does not achieve the proactive Hunt
purpose, and untargeted advertising or bulk lists would be less precise. Consent
must be used where electronic-marketing law requires it, but requesting consent
still requires an initial contact channel and does not remove the need for a
data-protection basis for collecting a named business contact.

The current implementation narrows the processing:

- `lib/discovery/contacts.ts` accepts only an email literally present on a
  fetched page, prefers events/booking role addresses, rejects unsafe/unrelated
  addresses and records provenance. It caps enrichment work and retries.
- `lib/discovery/serper.ts` binds extracted facts to an actual search result and
  rejects invented or ungrounded venue evidence.
- LinkedIn is find-only: the product stores a link, not a name scraped from a
  profile.
- `lib/outreach/caps.ts` limits each tenant to at most 18 pitch creations and 18
  sends per local day, split HOT/WARM/SEED.
- `lib/venues/follow-up.ts` allows at most one approval-gated follow-up for a HOT
  pitch; WARM and SEED pitches get no follow-up.

The same purpose does not require personal phone numbers, home addresses,
special-category data, inbox scraping, guessed addresses, long behavioural
profiles or unlimited retention. Subject to those boundaries, the necessity
test is met for the controlled-launch scope.

## 3. Balancing test

### Reasonable expectations and data nature

A venue that publishes an `events@`, `bookings@` or equivalent address is more
likely to expect relevant entertainment proposals than a person publishing an
address for an unrelated purpose. A named events employee still has personal
data rights even in a professional context. Public availability alone does not
make any reuse expected.

The data is low sensitivity and business-contextual, but the processing can
still surprise a contact because software discovers, scores and retains it. A
wrong contact, generic pitch, repeated contact by several artists, disclosure
of the database, or failure to honour an objection could cause annoyance,
reputational harm or loss of control.

No child is a target and the processing is not intended to make a legal or
similarly significant decision about a person. If a source suggests a personal,
minor-related, sensitive or non-business context, the record must not be used.

### Existing safeguards

- The contact must be traceable to a public source; guessed emails are barred.
- Prospect ownership, review decisions and send caps are tenant-scoped and
  profile-gated. Recipient hard-stop suppression is product-wide.
- Unknown/consent-first jurisdictions fail closed to automated sending in
  `lib/outreach/jurisdiction.ts`; this is an engineering guard, not a legal
  determination that a manual send is permitted.
- Tenant and product-wide suppression are checked at discovery, contact
  enrichment, drafting, follow-up, copy handoff and immediately before send.
- Every automated pitch carries sender identity, physical mailing address and
  an explicit reply-to-stop sentence appended at the send boundary.
- An explicit inbound opt-out or cease-and-desist records the message for audit,
  stops sequences and drafts, suppresses the address and blocks further sends.
- Sends use an atomic claim and conservative recovery path, reducing accidental
  duplicate messages.
- The internal `docs/PRIVACY-OPERATIONS.md` defines access, correction,
  objection, deletion, retention and incident procedures.

### Residual risks and operating restrictions

The balance passes only for the controlled-launch scope below, not unrestricted production use:

1. The 2026-08-17 release makes the public Privacy Policy and Article 14/PDPA
   indirect-collection notice effective and appends its URL to every first
   outreach footer. The release must be deployed and live-verified before Hunt
   sends resume under this assessment.
2. The 2026-08-16 release adds `GlobalOutreachSuppression`, a non-cascading
   product-wide hard stop for explicit opt-outs, cease-and-desist requests,
   spam complaints and definitive invalid recipients. All discovery, draft,
   copy and send boundaries consume it. Its additive migration is among the 39
   applied in production, and the boundary checks were live-validated on
   2026-08-16. The safeguard does not yet deduplicate an otherwise-unsuppressed
   venue across several artists
   or impose a cross-tenant contact-frequency cap; the controlled beta must
   monitor repeat-contact risk and sending must pause if duplication becomes
   material.
3. Official
   [ICO B2B guidance](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/business-to-business-marketing/)
   distinguishes corporate subscribers from sole traders and some partnerships.
   Bright Ears does not currently classify that status, so the rules engine now
   treats GB as `CONSENT`: automated sends remain disabled and the copy handoff
   requires the artist to confirm consent or another lawful basis. Manual
   transport is not itself a lawful basis. This is an engineering fail-closed
   control, not approval to target UK recipients.
4. Bright Ears does not actively target the UK or EU during controlled launch.
   GB, DE and AT remain consent/manual-only in the rules engine, and no manual
   handoff may be treated as permission to send. Any active UK/EU launch requires
   a new territorial-scope and representative review first.
5. The stated 12-month Hunt retention target has no automatic purge. The manual
   monthly review is required now; an automated and tested retention control is
   follow-up work.
6. A public email can have been copied, stale or published for another purpose.
   Complaint, bounce, wrong-contact and opt-out rates must be reviewed, with
   sending paused when they show expectations are not being met.

## Outcome

**Decision: conditional pass for a controlled launch.** The commercial purpose,
data minimisation and layered safeguards support legitimate interests for
carefully targeted, published business contacts under these restrictions:

- automated Hunt sending is limited to the countries currently classified
  `STANDARD` by `lib/outreach/jurisdiction.ts` (US, TH, NZ, IE, SG and AU);
- GB, CA, DE, AT and unknown countries remain consent/manual-only; Bright Ears
  does not actively target the UK or EU during this launch;
- every first outreach includes the effective privacy-notice URL, sender
  identity, physical mailing address and reply-to-stop language;
- the selected beta remains low-volume and monitored for wrong contacts,
  duplicate cross-tenant contact, complaints, bounces and opt-outs; sending is
  paused and investigated if those indicators show unexpected harm;
- the documented monthly manual retention review remains mandatory until an
  automated purge is implemented and tested; and
- provider privacy/data-transfer settings and product-wide suppression remain
  part of each release read-back.

This is a founder-approved operational assessment, not a representation that an
independent law firm has issued an opinion. Review at least annually and
immediately after a new country/source/data category, materially higher send
volume, automation change, security incident, regulator guidance change,
sustained complaint/opt-out increase or evidence that contacts are surprised or
harmed.

## Approval record

| Decision | Name/role | Date | Restrictions / review date |
|---|---|---|---|
| Approved for controlled launch | Norbert Platzer, founder | 2026-08-17 | Restrictions above; review by 2027-08-17 |
| Independent legal opinion | Not commissioned | — | Obtain before active UK/EU launch or materially broader automation |
