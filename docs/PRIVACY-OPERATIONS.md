# Privacy operations runbook

Status: internal operating procedure, last reviewed 2026-08-16. This is not a
substitute for legal advice and does not make the public draft legal documents
effective.

Bright Ears has no self-serve data export or account-deletion control in the
current build. Until those exist, the founder must run the steps below for every
request and keep an auditable case record. Never claim a request is complete
until the verification checklist passes.

## Ownership and intake

- **Privacy owner:** the founder. Owns `info@brightears.io`, the restricted case
  register, deadline decisions, requester communications, exceptions and final
  sign-off.
- **Technical operator:** performs scoped searches, exports, corrections and
  deletion; never makes the legal-basis decision and never places raw personal
  data or secrets in tickets, chat, source control or application logs.
- **Customer/controller:** decides requests concerning its own leads and
  end-clients. Bright Ears assists as processor on written instructions.
- **Legal reviewer:** approves the legal basis, exceptions, contested identity,
  legal holds, regulator/individual breach notices and the public legal set.

Log every request on receipt with a unique case ID, received date/time,
requester and contact channel, data role, affected tenant/data subject,
requested action, identity status, applicable deadline, legal hold/exception,
operator, actions/providers checked, response date and closure approval. Store
the case register in a founder-controlled restricted system; store record IDs
rather than message contents wherever possible.

Use a 30-calendar-day internal response target unless counsel sets an earlier
or different statutory deadline. Escalate on day zero if the jurisdiction is
uncertain. Record any permitted extension before the original target expires.

## Classify the request first

| Data | Bright Ears role | Route |
|---|---|---|
| Artist account, profile, subscription and usage | Controller | Bright Ears handles directly |
| Artist's lead/end-client inquiry and thread | Processor | Acknowledge, route to the artist/controller, assist on written instruction |
| Public venue/contact data collected by Hunt | Controller | Bright Ears handles directly |
| Free-tool/marketing email capture | Controller | Bright Ears handles directly |
| Misuse, security or suspected disclosure | Controller and/or processor | Start the incident procedure as well as the rights request |

An opt-out is immediate operational work, not a request to leave in the normal
queue. Suppress first, then finish identity and erasure analysis.

## Verify identity with minimum extra data

1. Prefer a request made while signed in through the requester's verified Clerk
   account. Match the Clerk user to `Member.clerkUserId`, then to the tenant.
2. For email intake, reply to the address already on file and ask the requester
   to sign in or complete a one-time mailbox verification. Do not ask for a
   passport or government ID by default.
3. For a lead/end-client, match the sender address to the scoped `Lead` and
   `Message` records. If needed, ask for one low-risk corroborating fact such as
   event date or venue; never reveal the record while testing identity.
4. For a venue contact, verify control of the email stored as the booking
   address or the named-contact business address. A role address may require a
   reply from that mailbox plus a current public source.
5. For an authorised agent, verify both the agent and written authority from
   the data subject. Record only the evidence needed for the decision.

If identity remains uncertain, restrict processing while the privacy owner and
legal reviewer decide. Record the reason for any refusal; do not silently close
the case.

## Locate the data

Resolve one canonical tenant by exact `Business.id` and confirm its slug, name,
owner email and Stripe identifiers before any write. Check:

- `Business`, `Member`, `Performer`, `Package`, `Gig`, `TravelWindow`;
- `Lead`, `Message`, `Draft`, `SequenceTemplate`, `SequenceRun`;
- `Venue`, `VenueSignal`, `VenuePitch`, `OutreachSuppression` and the matching
  minimal `GlobalOutreachSuppression` row;
- `MailboxConnection` metadata and `PushSubscription` records;
- `LlmUsage` (token/cost counts only); and
- `MarketingContact` rows matching the person's email (these are global and do
  not cascade from `Business`).

Also check the provider records that the database only references: Clerk user,
Stripe customer/subscription, Google OAuth grant and sent mailbox, Postmark
delivery activity, Render logs/backups, OpenRouter/provider logs where
available, and Cloudflare R2 objects under `business/{businessId}/`.

Do not decrypt or export OAuth ciphertext, push authentication keys, webhook
secrets, internal anti-abuse controls or another person's data. Record that
they were searched and withheld/redacted where appropriate.

## Access and portable export

1. Freeze the scope and snapshot time in the case record. Use read-only access
   first and save record counts per model.
2. For an artist/account export, produce structured JSON or CSV for the tenant
   models above, plus human-readable profile, billing and conversation files.
   Obtain billing history from Stripe when requested; do not infer it from the
   plan enum alone.
3. For a lead/end-client request, export only the matching person's inquiry,
   messages and derived lead fields, not the artist's whole workspace or other
   participants' data.
4. For a venue-contact request, search case-insensitively across the venue's
   booking email, named contact, pitches and captured reply thread. Include the
   public source/provenance and suppression status.
5. Redact third-party personal data and security material. Have a second person
   compare the export counts and scope against the case record.
6. Deliver through an encrypted, access-controlled link with a short expiry;
   send the password/second factor through a different channel. Delete working
   copies after confirmed delivery and log that deletion.

## Correction

- Let an authenticated artist correct normal profile fields in Settings. For a
  change to owner email or tenant identity, reconcile Clerk, `Member`,
  `Business.ownerEmail`, Stripe and mailbox ownership together; never update
  only one system.
- For lead/end-client data, obtain the artist/controller's written instruction.
  Correct derived structured fields without rewriting the original inbound
  message; retain the request/correction audit trail separately.
- For Hunt data, update or remove the inaccurate contact and provenance, cancel
  unsent pitches to the old address, and suppress the old address when sending
  to it would be unsafe.

Re-run the exact search after correction and record before/after values without
copying unnecessary message contents into the case register.

## Objection and all-Bright-Ears opt-out

A direct-marketing objection takes effect immediately. The database now keeps
two complementary controls:

1. `OutreachSuppression` is the tenant-local list. It includes explicit
   recipient stops, definitive delivery failures and artist-owned “not a fit”
   choices for that workspace.
2. `GlobalOutreachSuppression` is the all-Bright-Ears hard stop. It stores only
   the normalised email, a bounded reason, timestamps and (where available) the
   originating `Business.id` as non-relational audit metadata. It has no
   `Business` foreign key, so deleting a tenant cannot erase the stop.
3. Explicit unsubscribe/C&D requests, signed opt-out links and spam complaints
   atomically upsert tenant and global rows. Definitive hard/invalid-recipient
   bounces do likewise; soft/transient bounces do not become global. Artist
   “not a fit”/skip feedback never creates a global row.
4. Discovery ingest, contact enrichment, Hunt drafting/follow-ups and handoff
   copy, reactive sequences, and both reactive and Hunt send boundaries check
   the global list as well as the current tenant list. A global hit always
   wins.

For a manual privacy objection received at `info@brightears.io`, normalise and
upsert the address into `GlobalOutreachSuppression` before doing any broader
identity/erasure work. Do not copy the person's message or a business display
name into the row. Mark matching live tenant records safely, stop queued work,
and never auto-reopen a sent/uncertain `SENDING` record.

## Account closure and erasure

Cancellation and data deletion are separate. Stripe portal cancellation only
stops renewal; it does not delete the Bright Ears workspace.

1. Confirm the exact tenant, authorised owner, requested closure date, export
   choice, legal holds and records that must be retained.
2. Stop new processing immediately when closure is requested: pause the plan,
   disable sequence templates, stop open sequence runs, settle pending drafts
   and pitches, hide the EPK, remove push subscriptions and disconnect the
   mailbox. Inspect every stale `SENDING` pitch using the uncertain-send
   procedure in `docs/DEPLOYMENT.md`; never resend or reopen an ambiguous send.
3. Cancel the Stripe subscription and verify its final state before deleting
   the tenant. A live subscription must never be left without its
   customer-to-business mapping.
4. Complete and deliver any requested export before destructive work.
5. Preserve only approved legal/tax records and the minimum suppression record
   separately. Do not preserve full conversations under a vague "just in case"
   label.
6. Delete the canonical `Business` only after a second-person check. Its Prisma
   relations cascade most tenant data, but this does **not** remove matching
   `MarketingContact`, the Clerk user, Stripe records or R2 objects.
7. Delete matching `MarketingContact` rows when no exception applies. Delete or
   deactivate the Clerk user, revoke the Google grant, and apply the approved
   Stripe retention action. Provider-generated sent mail cannot be recalled
   from recipients; state that limitation accurately.
8. In Cloudflare R2, delete every object under `business/{businessId}/` and
   verify the prefix is empty. Remove external photo URLs from the database;
   Bright Ears cannot delete an image hosted by the artist or another provider.
9. Record the database deletion time and the date it ages out of backups. Render
   currently provides seven-day point-in-time recovery and logical exports;
   deleted data may remain in access-restricted backups until that rotation
   completes and must not be restored into live service except for disaster
   recovery.

The draft public policy sets a maximum of 90 days after closure for account and
lead data. The case register is the deadline source until closure timestamps and
purge automation exist.

## Retention review

On the first business day of each month, the privacy owner must review:

- closure cases approaching or past their 90-day deletion deadline;
- Hunt venue/contact records with no activity in the previous 12 months;
- stale R2 objects no longer referenced by any `photoUrls` value;
- expired access/export packages and local working copies;
- provider retention settings, especially OpenRouter/model-provider logging;
  the public draft's target of at most 30 days must not be represented as
  configured until the live provider settings are verified; and
- global suppression enforcement logs/tests and any manual privacy objections
  not yet represented in `GlobalOutreachSuppression`.

Document counts, actions, exceptions and the next review date. A manual review
is the current control; retention cron automation remains follow-up work.

## Incident procedure

1. Open an incident record immediately and notify the privacy owner. Record
   discovery time, systems/data/tenants involved, containment owner and an
   evidence location; keep raw personal data out of the timeline.
2. Contain without destroying evidence: revoke exposed credentials/tokens,
   pause affected sends or endpoints, restrict access and preserve relevant
   provider audit logs.
3. Determine whether Bright Ears is controller or processor for each dataset.
   If it is processor data, notify the affected artist/controller without undue
   delay with known facts and updates.
4. Ask the legal reviewer to assess risk, affected jurisdictions and regulator
   or individual notifications immediately. The Thai PDPA and GDPR can create a
   72-hour regulator window; do not wait for perfect information before legal
   triage.
5. Log decisions, notifications, recovery, credential rotation and corrective
   actions. After containment, run a blameless review and update this runbook,
   controls and tests.

## Closure verification

The privacy owner signs off only after the case record shows:

- identity, scope, role and deadline resolved;
- all in-scope database/provider locations searched;
- export/correction/deletion independently checked;
- subscription and automation state safe;
- R2 prefix empty when deletion applies;
- minimal suppression retained and seeded as required;
- backup-expiry date recorded;
- requester/controller response sent; and
- temporary working data destroyed.
