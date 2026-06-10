// Dev utility: approve the most recent PENDING draft end-to-end (send via the
// configured transport, flip lead to REPLIED). Usage: npx tsx scripts/test-approve.ts
import { config } from "dotenv";
config({ path: [".env.local", ".env"] });

async function main() {
  const { db } = await import("../lib/db");
  const { approveDraft } = await import("../app/actions/drafts");
  const draft = await db.draft.findFirst({
    where: { status: "PENDING" },
    include: { lead: true },
    orderBy: { createdAt: "desc" },
  });
  if (!draft) {
    console.log("no pending draft");
    process.exit(1);
  }
  console.log(`approving draft for lead ${draft.lead.clientName} (${draft.lead.status})`);
  try {
    const result = await approveDraft(draft.id);
    console.log("result:", JSON.stringify(result));
  } catch (err) {
    // revalidatePath throws outside a Next request context — send+DB already done.
    if (!(err as Error).message.includes("static generation store")) throw err;
    console.log("(revalidatePath skipped outside request context — expected in scripts)");
  }
  const after = await db.lead.findUnique({
    where: { id: draft.leadId },
    select: { status: true, firstReplyAt: true },
  });
  console.log("lead after:", JSON.stringify(after));
  await db.$disconnect();
}
main();
