// Dev playground: one demo business with packages, performers, gigs and
// leads in every pipeline state. Idempotent: wipes and recreates the demo tenant.
import { PrismaClient, LeadSource, LeadStatus } from "../app/generated/prisma/client";

const db = new PrismaClient();

function daysFromNow(days: number, hour = 12): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  await db.business.deleteMany({ where: { slug: "demo-dj-co" } });

  const business = await db.business.create({
    data: {
      name: "Demo DJ Co",
      slug: "demo-dj-co",
      ownerEmail: "owner@demodjco.test",
      ownerName: "Jamie Demo",
      country: "US",
      timezone: "America/New_York",
      websiteUrl: "https://demodjco.test",
      voiceSamples:
        "Hey! Thanks so much for reaching out — congrats on the engagement! We'd love to hear more about what you have planned. We keep things fun and stress-free: you tell us the vibe, we handle the rest.",
      members: {
        create: { email: "owner@demodjco.test", name: "Jamie Demo", isOwner: true },
      },
      performers: {
        create: [
          { name: "Jamie (DJ J)", kind: "DJ" },
          { name: "Sam — Photo Booth", kind: "PHOTO_BOOTH" },
        ],
      },
      packages: {
        create: [
          {
            name: "Wedding Essentials (6h)",
            description: "Ceremony + reception DJ, MC duties, dance floor lighting.",
            priceMin: 180000,
            priceMax: 220000,
            eventTypes: ["wedding"],
          },
          {
            name: "Wedding + Photo Booth (6h)",
            description: "Everything in Essentials plus open-air photo booth with attendant.",
            priceMin: 250000,
            priceMax: 290000,
            eventTypes: ["wedding"],
          },
          {
            name: "Corporate / Private Party (4h)",
            description: "DJ + sound system for corporate events and private parties.",
            priceMin: 90000,
            priceMax: 120000,
            eventTypes: ["corporate", "birthday", "private party"],
          },
        ],
      },
      sequences: {
        create: { name: "Default follow-up", stepsDays: [2, 5, 9] },
      },
    },
    include: { performers: true, sequences: true },
  });

  const dj = business.performers.find((p) => p.kind === "DJ")!;

  // Booked gigs → availability conflicts for the draft engine to respect
  await db.gig.createMany({
    data: [
      { businessId: business.id, performerId: dj.id, date: daysFromNow(30), startTime: "17:00", endTime: "23:00", title: "Miller wedding", venue: "Lakeside Manor" },
      { businessId: business.id, performerId: dj.id, date: daysFromNow(37), startTime: "18:00", endTime: "23:00", title: "TechCorp summer party", venue: "Rooftop 21" },
    ],
  });

  const mkLead = (over: Partial<Parameters<typeof db.lead.create>[0]["data"]>) =>
    db.lead.create({
      data: {
        businessId: business.id,
        source: LeadSource.WEBSITE_FORM,
        status: LeadStatus.NEW,
        rawBody: "placeholder",
        ...over,
      } as Parameters<typeof db.lead.create>[0]["data"],
    });

  // 1. NEW — fresh wedding inquiry, date free
  await mkLead({
    clientName: "Emily Carter",
    clientEmail: "emily.c@example.com",
    eventType: "wedding",
    eventDate: daysFromNow(120, 16),
    venue: "Harvest Barn",
    guestCount: 140,
    rawSubject: "Wedding DJ inquiry — June date",
    rawBody:
      "Hi! We're getting married and looking for a DJ. Do you have our date available? We'd love ceremony music and a fun reception. Budget around $2,000.",
  });

  // 2. NEW — date conflicts with Miller wedding (tests availability logic)
  await mkLead({
    source: LeadSource.THE_KNOT,
    clientName: "Priya & Dev",
    clientEmail: "priya.dev@example.com",
    eventType: "wedding",
    eventDate: daysFromNow(30, 17),
    venue: "Lakeside Manor",
    guestCount: 200,
    rawSubject: "New lead from The Knot",
    rawBody: "You have received a new lead! Event: Wedding. Guests: 200.",
  });

  // 3. SPAM — advance-fee pattern
  await mkLead({
    source: LeadSource.PLAIN_EMAIL,
    clientName: "Mr Wire Transfer",
    clientEmail: "urgent.payment@example.com",
    rawSubject: "EVENT BOOKING — payment via certified check",
    rawBody:
      "I want to book you for my son's surprise party. I will send a check above your fee, you wire back the difference to the planner.",
    status: LeadStatus.SPAM,
    spamScore: 0.97,
    spamReason: "Overpayment / wire-back advance-fee pattern",
  });

  // 4. DRAFTED — corporate inquiry with pending draft
  const drafted = await mkLead({
    source: LeadSource.PLAIN_EMAIL,
    clientName: "Mark Olsen",
    clientEmail: "m.olsen@bigco.example.com",
    eventType: "corporate",
    eventDate: daysFromNow(45, 18),
    guestCount: 80,
    rawSubject: "Holiday party DJ?",
    rawBody: "We're planning our company holiday party for ~80 people. What would that cost?",
    status: LeadStatus.DRAFTED,
  });
  await db.draft.create({
    data: {
      leadId: drafted.id,
      subject: "Re: Holiday party DJ?",
      body: "Hi Mark — thanks for reaching out! Great news: that date is open. Our corporate package (4h, DJ + full sound) runs $900–1,200 depending on setup...",
    },
  });

  // 5-10. REPLIED / IN_SEQUENCE / ENGAGED / BOOKED / DEAD / vague-date NEW
  const replied = await mkLead({
    source: LeadSource.WEDDINGWIRE,
    clientName: "Sofia Reyes",
    clientEmail: "sofia.r@example.com",
    eventType: "wedding",
    eventDate: daysFromNow(90, 16),
    rawSubject: "New WeddingWire lead",
    rawBody: "Looking for a bilingual DJ for our wedding, about 120 guests.",
    status: LeadStatus.REPLIED,
    firstReplyAt: new Date(),
  });
  await db.message.createMany({
    data: [
      { leadId: replied.id, direction: "INBOUND", subject: "New WeddingWire lead", body: replied.rawBody, fromEmail: "leads@weddingwire.example" },
      { leadId: replied.id, direction: "OUTBOUND", subject: "Re: your wedding!", body: "Hi Sofia — yes, we're available and Jamie MCs in English and Spanish...", toEmail: "sofia.r@example.com" },
    ],
  });

  const inSeq = await mkLead({
    clientName: "Tom Becker",
    clientEmail: "tbecker@example.com",
    eventType: "wedding",
    eventDate: daysFromNow(150, 15),
    rawSubject: "DJ availability",
    rawBody: "Checking availability and pricing for our wedding next spring.",
    status: LeadStatus.IN_SEQUENCE,
    firstReplyAt: daysFromNow(-3),
  });
  await db.sequenceRun.create({
    data: { leadId: inSeq.id, templateId: business.sequences[0].id, currentStep: 1, nextRunAt: daysFromNow(2) },
  });

  await mkLead({
    clientName: "Aisha & Jordan",
    clientEmail: "aisha.j@example.com",
    eventType: "wedding",
    eventDate: daysFromNow(200, 16),
    rawSubject: "quick question about packages",
    rawBody: "Does the photo booth package include prints? We're deciding between two vendors.",
    status: LeadStatus.ENGAGED,
    firstReplyAt: daysFromNow(-5),
  });

  await mkLead({
    clientName: "Rachel Kim",
    clientEmail: "rk@example.com",
    eventType: "wedding",
    eventDate: daysFromNow(37, 18),
    venue: "Rooftop 21",
    rawSubject: "Booking confirmation",
    rawBody: "We'd love to book the Essentials package!",
    status: LeadStatus.BOOKED,
    firstReplyAt: daysFromNow(-20),
    bookedAt: daysFromNow(-15),
  });
  await mkLead({
    clientName: "Gary Price-Shopper",
    clientEmail: "gp@example.com",
    eventType: "birthday",
    rawSubject: "cheapest rate?",
    rawBody: "what is your absolute cheapest rate for 2 hours",
    status: LeadStatus.DEAD,
    firstReplyAt: daysFromNow(-30),
    deadAt: daysFromNow(-12),
  });

  await mkLead({
    source: LeadSource.GIGSALAD,
    clientName: "Nina Patel",
    clientEmail: "nina.p@example.com",
    eventType: "wedding",
    rawSubject: "GigSalad: new quote request",
    rawBody: "We haven't picked a date yet, sometime next fall. What are your packages?",
  });

  const counts = await db.lead.groupBy({ by: ["status"], where: { businessId: business.id }, _count: true });
  console.log(`Seeded "${business.name}" (${business.slug})`);
  console.log(counts.map((c) => `${c.status}: ${c._count}`).join(", "));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
