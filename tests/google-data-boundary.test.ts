import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

describe("Google API user-data boundary", () => {
  it("requests send-only Gmail access and no mailbox-reading scope", () => {
    const oauth = source("lib/oauth/google.ts");

    expect(oauth).toContain("https://www.googleapis.com/auth/gmail.send");
    expect(oauth).not.toMatch(/gmail\.(?:readonly|modify|metadata)|\/auth\/gmail\b(?!\.send)/);
    expect(oauth).not.toContain("gmail.readonly");
  });

  it("keeps the Gmail transport and OpenRouter gateway dependency-separated", () => {
    const gmail = source("lib/outbound/gmail.ts");
    const llm = source("lib/llm/index.ts");

    expect(gmail).toContain("/gmail/v1/users/me/messages/send");
    expect(gmail).not.toMatch(/@\/lib\/llm|openrouter/i);
    expect(llm).not.toMatch(/@\/lib\/(?:oauth\/google|outbound\/gmail)|gmailapis\.com/i);
  });

  it("gives a prominent pre-consent disclosure and the Google Limited Use statement", () => {
    const mailbox = source("components/mailbox-card.tsx");
    const privacy = source("app/(marketing)/privacy/page.tsx");

    expect(mailbox).toMatch(/What connecting Gmail allows[\s\S]*?Connect Gmail\s*<\/a>/);
    expect(mailbox).toMatch(/never read, list or import/i);
    expect(mailbox).toMatch(/never sent to OpenRouter/i);
    expect(privacy).toContain(
      "Bright Ears&rsquo; use of information received from Google APIs will adhere to the Google API",
    );
    expect(privacy).toContain("Services User Data Policy, including the Limited Use requirements");
  });
});
