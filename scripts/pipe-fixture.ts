// Dev utility: pipe an InboundEmail fixture through the running webhook as a
// Postmark-shaped payload. Usage: npx tsx scripts/pipe-fixture.ts <fixture.json> [baseUrl]
import { readFileSync } from "node:fs";

const [, , fixturePath, baseUrl = "http://localhost:3057"] = process.argv;
if (!fixturePath) {
  console.error("usage: tsx scripts/pipe-fixture.ts <fixture.json> [baseUrl]");
  process.exit(1);
}

const fixture = JSON.parse(readFileSync(fixturePath, "utf8"));

const payload = {
  FromFull: { Email: fixture.from, Name: fixture.fromName },
  OriginalRecipient: fixture.to,
  Subject: fixture.subject,
  TextBody: fixture.textBody,
  HtmlBody: fixture.htmlBody,
  Headers: Object.entries(fixture.headers ?? {}).map(([Name, Value]) => ({ Name, Value })),
  // Unique per run so idempotency doesn't swallow repeat acceptance tests.
  MessageID: `${fixture.providerMessageId ?? "fixture"}-${process.hrtime.bigint()}`,
  Date: new Date().toUTCString(),
};

async function main() {
  const started = performance.now();
  const res = await fetch(`${baseUrl}/api/inbound`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const elapsed = ((performance.now() - started) / 1000).toFixed(2);
  const body = await res.json();
  console.log(`${res.status} in ${elapsed}s →`, JSON.stringify(body));
  if (!res.ok) process.exit(1);
}

main();
