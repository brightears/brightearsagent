import { describe, expect, it } from "vitest";
import { dequoteNewReply, detectExplicitOptOut } from "@/lib/inbound/opt-out-intent";

describe("dequoteNewReply", () => {
  it("keeps only newly-written Gmail reply text", () => {
    const body = [
      "Thanks, but please remove us from your mailing list.",
      "",
      "On Sun, Aug 16, 2026 at 9:00 AM Sapphire Sounds wrote:",
      "> If you'd rather not hear from us again, use this opt-out link.",
    ].join("\n");
    expect(dequoteNewReply(body)).toBe("Thanks, but please remove us from your mailing list.");
  });

  it("cuts Outlook original-message headers and corporate signatures", () => {
    expect(
      dequoteNewReply(
        "No thanks.\n-- \nEvents team\nUnsubscribe\n\nFrom: Artist <artist@example.com>\nSent: Sunday\nTo: Events\nSubject: Friday",
      ),
    ).toBe("No thanks.");
  });
});

describe("detectExplicitOptOut", () => {
  it.each([
    ["Please unsubscribe me from your list.", "unsubscribe"],
    ["Hello,\nplease unsubscribe me.", "unsubscribe"],
    ["Thanks, but please unsubscribe me.", "unsubscribe"],
    ["Thanks for the note; please opt us out.", "unsubscribe"],
    ["Stop emailing us.", "unsubscribe"],
    ["Don't send me any more emails.", "unsubscribe"],
    ["Do not contact this address again.", "unsubscribe"],
    ["I don't wish to receive any further emails.", "unsubscribe"],
    ["Consider this a cease-and-desist.", "cease-and-desist"],
    ["Please cease and desist all communications.", "cease-and-desist"],
    ["Cease & desist immediately.", "cease-and-desist"],
  ])("recognises explicit stop language: %s", (body, expected) => {
    expect(detectExplicitOptOut(body)).toBe(expected);
  });

  it.each([
    ["de", "Bitte kontaktieren Sie mich nicht mehr."],
    ["fr", "Veuillez me désabonner."],
    ["es", "Por favor, denme de baja."],
    ["it", "Non contattatemi più."],
    ["nl", "Schrijf mij uit."],
    ["pt", "Não quero receber mais e-mails."],
    ["th", "โปรดอย่าติดต่อฉันอีก"],
    ["ja", "配信停止してください。"],
  ])("recognises an explicit stop request in %s: %s", (_language, body) => {
    expect(detectExplicitOptOut(body)).toBe("unsubscribe");
  });

  it.each([
    "No thanks, we're already booked.",
    "We're not interested in a DJ this month.",
    "Do not hesitate to contact me if a Wednesday opens up.",
    "Please don't email the rate sheet yet.",
    "Please stop by our venue next week.",
    "You can remove us from the Friday lineup.",
    "Is this supposed to be a cease and desist notice?",
  ])("does not turn an ordinary negative or unrelated phrase into suppression: %s", (body) => {
    expect(detectExplicitOptOut(body)).toBeNull();
  });

  it.each([
    ["de", "Wir haben derzeit kein Interesse an einem DJ."],
    ["fr", "Nous ne sommes pas intéressés par un DJ ce mois-ci."],
    ["es", "No estamos interesados en un DJ este mes."],
    ["it", "Non siamo interessati a un DJ questo mese."],
    ["nl", "We zijn deze maand niet geïnteresseerd in een DJ."],
    ["pt", "Não temos interesse em um DJ este mês."],
    ["th", "ตอนนี้เราไม่สนใจจ้างดีเจ"],
    ["ja", "今月はDJに興味がありません。"],
  ])("keeps an ordinary rejection in %s in the reply flow: %s", (_language, body) => {
    expect(detectExplicitOptOut(body)).toBeNull();
  });

  it("ignores explicit opt-out words found only in quoted history", () => {
    const body = [
      "No thanks — the dates don't work for us.",
      "",
      "On Sun, Aug 16, 2026 at 9:00 AM Events wrote:",
      "> Please unsubscribe me and do not contact me again.",
    ].join("\n");
    expect(detectExplicitOptOut(body)).toBeNull();
  });
});
