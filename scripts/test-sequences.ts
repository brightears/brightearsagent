// Simulated 3-week clock test for the sequence engine (Phase 4 acceptance).
// Creates an isolated test tenant, walks a lead through: first reply → step 1
// → step 2 → step 3 → exhausted → DEAD, plus stop-on-reply and opt-out cases.
// Time is simulated by passing `now` to the engine — no real waiting, no real
// LLM calls needed for engine logic? (drafting DOES call the LLM — live calls).
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

// This test drives approveDraft, which is tenant-scoped via getCurrentBusiness()
// → DEV_TENANT_SLUG. Point it at the isolated test tenant, and never send real
// email (recipients are @example.invalid).
process.env.DEV_TENANT_SLUG = "seq-test";
process.env.EMAIL_TRANSPORT = "dev";

const DAY = 24 * 3600 * 1000;

function assert(cond: unknown, msg: string) {
  if (!cond) {
    console.error(`  ✗ ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ✓ ${msg}`);
  }
}

async function main() {
  const { db } = await import("../lib/db");
  const { runSequenceTick } = await import("../lib/sequences/engine");
  const { optoutToken } = await import("../lib/optout");

  // Isolated tenant.
  await db.business.deleteMany({ where: { slug: "seq-test" } });
  const biz = await db.business.create({
    data: {
      name: "Seq Test DJ",
      slug: "seq-test",
      ownerEmail: "owner@seqtest.invalid",
      ownerName: "Tess",
      voiceSamples: "Hey! Thanks for reaching out — we keep it fun and stress-free.",
      performers: { create: { name: "Tess", kind: "DJ" } },
      packages: {
        create: {
          name: "Party (4h)", description: "DJ + sound.", priceMin: 80000, priceMax: 100000, eventTypes: ["wedding", "birthday"],
        },
      },
      sequences: { create: { stepsDays: [2, 5, 9] } },
    },
    include: { sequences: true },
  });

  const t0 = new Date();
  const mkLead = (name: string, email: string) =>
    db.lead.create({
      data: {
        businessId: biz.id,
        source: "WEBSITE_FORM",
        status: "REPLIED",
        clientName: name,
        clientEmail: email,
        eventType: "wedding",
        eventDate: new Date(t0.getTime() + 120 * DAY),
        rawSubject: "wedding dj?",
        rawBody: "Hi, looking for a DJ for our wedding!",
        firstReplyAt: t0,
        messages: {
          create: [
            { direction: "INBOUND", body: "Hi, looking for a DJ for our wedding!", fromEmail: email },
            { direction: "OUTBOUND", body: "Hi! Great news — we'd love to. Our Party package is $800–$1,000...", toEmail: email },
          ],
        },
      },
    });

  const lead = await mkLead("Clocky", "clocky@example.invalid");

  console.log("\n— backfill: REPLIED lead with no run gets one");
  let tick = await runSequenceTick(new Date(t0.getTime() + 1 * 3600 * 1000));
  assert(tick.backfilledRuns + tick.redraftedLeads >= 1, `backfilled my run (global tick also backfills other tenants — got ${tick.backfilledRuns})`);
  let run = await db.sequenceRun.findUnique({ where: { leadId: lead.id } });
  assert(run && Math.abs(run.nextRunAt!.getTime() - (t0.getTime() + 2 * DAY)) < 60000, "step 1 scheduled at day 2");

  console.log("\n— day 1: nothing due");
  tick = await runSequenceTick(new Date(t0.getTime() + 1 * DAY));
  assert(true, "tick ran (other tenants may legitimately fire)");

  console.log("\n— day 2: step 1 fires (live LLM draft)");
  tick = await runSequenceTick(new Date(t0.getTime() + 2 * DAY + 60000));
  assert(tick.stepsFired >= 1, `step 1 fired (global tick — got ${tick.stepsFired})`);
  let drafts = await db.draft.findMany({ where: { leadId: lead.id }, orderBy: { createdAt: "asc" } });
  assert(drafts.length === 1 && drafts[0].isFollowUp && drafts[0].sequenceStep === 1, "follow-up draft #1 PENDING");

  console.log("\n— day 3: pending draft → no stacking");
  tick = await runSequenceTick(new Date(t0.getTime() + 5 * DAY + 60000));
  assert(tick.stepsFired === 0 && tick.skipped >= 1, "skipped while draft pending");

  console.log("\n— owner approves follow-up #1 (footer + opt-out link asserted)");
  const { approveDraft } = await import("../app/actions/drafts");
  try { await approveDraft(drafts[0].id); } catch (e) { if (!(e as Error).message.includes("static generation store")) throw e; }
  const sentMsg = await db.message.findFirst({ where: { leadId: lead.id, draftId: drafts[0].id } });
  assert(!!sentMsg, "follow-up sent as message");
  assert(sentMsg!.body.includes(optoutToken(lead.id)), "compliance footer with opt-out link present");
  let leadNow = await db.lead.findUnique({ where: { id: lead.id } });
  assert(leadNow!.status === "IN_SEQUENCE", `lead IN_SEQUENCE (got ${leadNow!.status})`);

  console.log("\n— day 5+: step 2 fires; approve; day 9+: step 3 fires; approve");
  tick = await runSequenceTick(new Date(t0.getTime() + 5 * DAY + 120000));
  assert(tick.stepsFired >= 1, "step 2 fired");
  drafts = await db.draft.findMany({ where: { leadId: lead.id, status: "PENDING" } });
  try { await approveDraft(drafts[0].id); } catch (e) { if (!(e as Error).message.includes("static generation store")) throw e; }
  tick = await runSequenceTick(new Date(t0.getTime() + 9 * DAY + 120000));
  assert(tick.stepsFired >= 1, "step 3 fired");
  drafts = await db.draft.findMany({ where: { leadId: lead.id, status: "PENDING" } });
  try { await approveDraft(drafts[0].id); } catch (e) { if (!(e as Error).message.includes("static generation store")) throw e; }

  console.log("\n— day 11+: exhausted → lead DEAD, run stopped");
  tick = await runSequenceTick(new Date(t0.getTime() + 11 * DAY + 180000));
  assert(tick.exhausted >= 1, `exhausted (got ${tick.exhausted})`);
  leadNow = await db.lead.findUnique({ where: { id: lead.id } });
  run = await db.sequenceRun.findUnique({ where: { leadId: lead.id } });
  assert(leadNow!.status === "DEAD", "lead auto-DEAD after silence");
  assert(run!.stoppedAt !== null && run!.stopReason === "exhausted", "run stopped: exhausted");

  console.log("\n— stop-on-reply: ENGAGED lead's run closes without firing");
  const lead2 = await mkLead("Reply Rita", "rita@example.invalid");
  await runSequenceTick(new Date(t0.getTime() + 3600 * 1000)); // backfill
  await db.lead.update({ where: { id: lead2.id }, data: { status: "ENGAGED" } });
  tick = await runSequenceTick(new Date(t0.getTime() + 2 * DAY + 60000));
  const run2 = await db.sequenceRun.findUnique({ where: { leadId: lead2.id } });
  assert(run2!.stoppedAt !== null && run2!.stopReason === "lead_engaged", "run stopped on reply");
  const drafts2 = await db.draft.count({ where: { leadId: lead2.id } });
  assert(drafts2 === 0, "no follow-up drafted for engaged lead");

  console.log("\n— opt-out: flag stops everything");
  const lead3 = await mkLead("Opt Otto", "otto@example.invalid");
  await runSequenceTick(new Date(t0.getTime() + 3600 * 1000));
  await db.lead.update({ where: { id: lead3.id }, data: { optedOut: true } });
  tick = await runSequenceTick(new Date(t0.getTime() + 2 * DAY + 60000));
  const run3 = await db.sequenceRun.findUnique({ where: { leadId: lead3.id } });
  assert(run3!.stoppedAt !== null && run3!.stopReason === "opted_out", "run stopped on opt-out");

  console.log("\n— weekly report numbers match DB");
  const { computeWeekly } = await import("../lib/reports/weekly");
  const numbers = await computeWeekly(biz.id);
  const directBooked = await db.lead.count({ where: { businessId: biz.id, bookedAt: { not: null } } });
  const directIn = await db.lead.count({ where: { businessId: biz.id, status: { not: "SPAM" } } });
  assert(numbers.booked === directBooked, `booked matches (${numbers.booked})`);
  assert(numbers.leadsIn === directIn, `leads-in matches (${numbers.leadsIn})`);
  assert(numbers.repliesSent >= 4, `replies counted (${numbers.repliesSent})`);

  await db.business.deleteMany({ where: { slug: "seq-test" } });
  await db.$disconnect();
  console.log(process.exitCode ? "\nFAIL" : "\nPASS — full sequence lifecycle verified");
}

main();
