import {readFile} from "node:fs/promises";
import {describe, expect, it} from "vitest";
import {approvedRecipientFromTexts, captureLive, headedAuth, remainingSceneHoldMs} from "../src/capture.js";
import {tutorialManifestSchema} from "../src/manifest.js";

async function fixture(name: string) {
  return JSON.parse(await readFile(new URL(`../manifests/${name}`, import.meta.url), "utf8"));
}

describe("tutorial manifests", () => {
  it("accepts the synthetic Sprint 0 manifest with every external action disabled", async () => {
    const manifest = tutorialManifestSchema.parse(await fixture("sprint0-placeholder.json"));
    expect(manifest.capturePolicy.mode).toBe("synthetic-only");
    expect(manifest.capturePolicy.allowMailboxChange).toBe("never");
    expect(manifest.capturePolicy.allowSend).toBe("never");
    expect(manifest.capturePolicy.allowUpload).toBe(false);
    expect(manifest.scenes.every((scene) => scene.kind === "synthetic")).toBe(true);
  });

  it("requires explicit approval policy for every Sprint 1 external action", async () => {
    const manifest = tutorialManifestSchema.parse(await fixture("google-oauth-verification.sprint1.json"));
    expect(manifest.capturePolicy.requireActionTimeConfirmation).toBe(true);
    expect(manifest.capturePolicy.recordCredentials).toBe(false);
    expect(manifest.capturePolicy.allowMailboxChange).toBe("approval-required");
    expect(manifest.capturePolicy.allowSend).toBe("approval-required");
    expect(manifest.capturePolicy.allowUpload).toBe(false);
  });

  it("rejects capture scenes hidden inside a synthetic-only manifest", async () => {
    const input = await fixture("google-oauth-verification.sprint1.json");
    input.capturePolicy.mode = "synthetic-only";
    expect(() => tutorialManifestSchema.parse(input)).toThrow(/synthetic-only/);
  });

  it("rejects manifests that permit recording credentials or uploads", async () => {
    const input = await fixture("sprint0-placeholder.json");
    input.capturePolicy.recordCredentials = true;
    input.capturePolicy.allowUpload = true;
    expect(() => tutorialManifestSchema.parse(input)).toThrow();
  });

  it("rejects capture edit windows longer than the planned scene", async () => {
    const input = await fixture("google-oauth-verification.sprint1.json");
    input.scenes.find((scene: {id: string}) => scene.id === "consent").editSegments = [
      {startSeconds: 0, durationSeconds: 36},
    ];
    expect(() => tutorialManifestSchema.parse(input)).toThrow(/edit segments exceed/);
  });
});

describe("live-action gates", () => {
  it("holds a capture scene for its planned minimum duration", () => {
    expect(remainingSceneHoldMs(20, 1_000, 6_500)).toBe(14_500);
    expect(remainingSceneHoldMs(20, 1_000, 21_000)).toBe(0);
    expect(remainingSceneHoldMs(20, 1_000, 25_000)).toBe(0);
  });

  it("allows a send only when exactly one visible mailbox matches the manifest allowlist", () => {
    expect(approvedRecipientFromTexts(["norbert@brightears.io"], ["norbert@brightears.io"]))
      .toBe("norbert@brightears.io");
    expect(() => approvedRecipientFromTexts(["leads@norbert.in.brightears.io"], ["norbert@brightears.io"]))
      .toThrow(/Refusing send/);
    expect(() => approvedRecipientFromTexts(["norbert@brightears.io", "other@example.com"], ["norbert@brightears.io"]))
      .toThrow(/Refusing send/);
  });

  it("refuses headed authentication before opening a browser", async () => {
    await expect(headedAuth("demo", "https://example.com")).rejects.toThrow(/Refusing headed login/);
  });

  it("refuses live recording without fresh action-time confirmation", async () => {
    await expect(captureLive("manifests/google-oauth-verification.sprint1.json")).rejects.toThrow(/Refusing live capture/);
  });
});
