/**
 * Journey eval runner — drives the REAL inbound pipeline against a seeded
 * tenant and asserts where each message actually landed.
 *
 *   npx tsx scripts/eval-journeys.ts            # all journeys
 *   npx tsx scripts/eval-journeys.ts returning  # only ids containing "returning"
 *   KEEP=1 npx tsx scripts/eval-journeys.ts     # leave tenants behind to inspect
 *
 * Exit code 1 if any expectation fails, so it can gate CI.
 *
 * LOCAL ONLY BY DESIGN. It seeds and deletes whole tenants, so it refuses to
 * run against anything that is not a local database — pointing this at
 * production would create junk businesses and burn a real customer's lead cap.
 */
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

import { JOURNEYS, type Journey, type JourneyStep } from "../evals/journeys";

const KEEP = !!process.env.KEEP;
const filter = process.argv[2];

function assertLocalDb() {
  const url = process.env.DATABASE_URL ?? "";
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) {
    console.error(
      "REFUSING TO RUN: DATABASE_URL is not local.\n" +
        "This harness creates and deletes tenants; it must never touch a shared or production database.",
    );
    process.exit(1);
  }
}

/** Deterministic parse address for a journey's throwaway tenant. */
const slugFor = (j: Journey) => `evalj-${j.id}`.slice(0, 30);

interface Failure { journey: string; step: string; detail: string }

async function main() {
  assertLocalDb();
  const { db } = await import("../lib/db");
  const { processInbound } = await import("../lib/inbound/pipeline");

  const journeys = filter ? JOURNEYS.filter((j) => j.id.includes(filter)) : JOURNEYS;
  const failures: Failure[] = [];
  let checks = 0;

  for (const journey of journeys) {
    const slug = slugFor(journey);
    await db.business.deleteMany({ where: { slug } }); // idempotent re-runs

    const business = await db.business.create({
      data: {
        name: "Eval DJ Co",
        slug,
        ownerEmail: `${slug}@eval.invalid`,
        ownerName: "Jamie",
        // A paid plan: on TRIAL the agent is paused and half the lifecycle
        // never runs, which would make these journeys prove nothing.
        plan: "STARTER",
        timezone: "Asia/Bangkok",
        sequences: { create: { stepsDays: [2, 5, 9] } },
      },
    });

    console.log(`\n▸ ${journey.id}`);
    console.log(`  ${journey.why}`);

    const leadIdByStep = new Map<string, string>();
    let previousMessageId = "";

    for (const [i, step] of journey.steps.entries()) {
      // Backdate the whole conversation so far — the only way to exercise the
      // reply-match window without waiting real days.
      if (step.ageExistingLeadDays) {
        const shift = step.ageExistingLeadDays * 86_400_000;
        const leads = await db.lead.findMany({ where: { businessId: business.id }, select: { id: true, createdAt: true } });
        for (const l of leads) {
          await db.lead.update({ where: { id: l.id }, data: { createdAt: new Date(l.createdAt.getTime() - shift) } });
          const msgs = await db.message.findMany({ where: { leadId: l.id }, select: { id: true, createdAt: true } });
          for (const m of msgs) {
            await db.message.update({ where: { id: m.id }, data: { createdAt: new Date(m.createdAt.getTime() - shift) } });
          }
        }
      }

      // A redelivery is the SAME provider message id — that is what makes it a
      // duplicate rather than a second inquiry.
      const messageId =
        step.expect.outcome === "duplicate" ? previousMessageId : `eval-${journey.id}-${i}`;
      previousMessageId = messageId;

      const result = await processInbound({
        from: step.from,
        fromName: step.fromName,
        to: (step.to ?? `leads@${slug}.in.brightears.io`).replace("__SLUG__", slug),
        subject: step.subject,
        textBody: step.textBody,
        htmlBody: step.htmlBody,
        headers: step.headers ?? {},
        providerMessageId: messageId,
      });

      const fail = (detail: string) => failures.push({ journey: journey.id, step: step.label, detail });
      const ok = (label: string) => console.log(`    ✓ ${label}`);

      checks++;
      if (result.outcome !== step.expect.outcome) {
        fail(`expected outcome "${step.expect.outcome}", got "${result.outcome}"`);
        console.log(`    ✗ ${step.label}: outcome ${result.outcome} (wanted ${step.expect.outcome})`);
        continue;
      }
      ok(`${step.label} → ${result.outcome}`);

      const leadId = "leadId" in result ? result.leadId : undefined;
      if (leadId) leadIdByStep.set(step.label, leadId);

      const e = step.expect;
      if (e.sameLeadAs) {
        checks++;
        const want = leadIdByStep.get(e.sameLeadAs);
        if (want && leadId !== want) fail(`should have attached to the lead from "${e.sameLeadAs}" but made/used a different one`);
        else ok(`same lead as "${e.sameLeadAs}"`);
      }
      if (e.differentLeadFrom) {
        checks++;
        const other = leadIdByStep.get(e.differentLeadFrom);
        if (other && leadId === other) fail(`swallowed into the lead from "${e.differentLeadFrom}" — this must be a NEW lead`);
        else ok(`distinct from "${e.differentLeadFrom}"`);
      }

      if (!leadId) continue;
      const lead = await db.lead.findUnique({ where: { id: leadId } });
      if (!lead) { fail(`lead ${leadId} vanished`); continue; }

      const check = (label: string, cond: boolean, detail: string) => {
        checks++;
        if (cond) ok(label); else { fail(detail); console.log(`    ✗ ${detail}`); }
      };

      if (e.status) check(`status ${e.status}`, lead.status === e.status, `status is ${lead.status}, expected ${e.status}`);
      if (e.eventType) check(`eventType ~ ${e.eventType}`, e.eventType.test(lead.eventType ?? ""), `eventType "${lead.eventType}" does not match ${e.eventType}`);
      if (e.eventDate) {
        const got = lead.eventDate ? lead.eventDate.toISOString().slice(0, 10) : null;
        check(`eventDate ${e.eventDate}`, got === e.eventDate, `eventDate ${got}, expected ${e.eventDate}`);
      }
      if (e.clientEmail) check("clientEmail", (lead.clientEmail ?? "").toLowerCase() === e.clientEmail, `clientEmail "${lead.clientEmail}", expected ${e.clientEmail}`);
      if (e.clientName) check(`clientName ~ ${e.clientName}`, e.clientName.test(lead.clientName ?? ""), `clientName "${lead.clientName}" does not match ${e.clientName}`);
      if (e.venueSane) {
        // The reasoning-leak signature: a model's monologue in a lead field.
        const dirty = [lead.venue, lead.clientName, lead.eventType].filter(
          (v): v is string => typeof v === "string" && (/[\n\r`{}]/.test(v) || v.length > 200),
        );
        check("no model reasoning leaked into lead fields", dirty.length === 0,
          `field contains reasoning leakage: ${JSON.stringify(dirty[0]?.slice(0, 120))}`);
      }
    }

    // Drafting is deliberately fire-and-forget in the pipeline, so it is still
    // in flight when the journey's last assertion lands. Deleting the tenant
    // underneath it produces a storm of foreign-key errors that are pure
    // harness noise — and worse, they bury real ones. Let it settle first.
    if (!KEEP) {
      await new Promise((r) => setTimeout(r, 1500));
      await db.business.delete({ where: { id: business.id } });
    }
  }

  console.log(`\n${"─".repeat(60)}`);
  if (failures.length) {
    console.log(`${failures.length} failure(s) of ${checks} checks across ${journeys.length} journey(s):\n`);
    for (const f of failures) console.log(`  ${f.journey} / ${f.step}\n    ${f.detail}`);
  } else {
    console.log(`all ${checks} checks passed across ${journeys.length} journey(s)`);
  }
  if (KEEP) console.log(`\nKEEP=1 — seeded tenants left in place (slugs beginning "evalj-")`);

  await db.$disconnect();
  process.exit(failures.length ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
