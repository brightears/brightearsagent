import {createInterface} from "node:readline/promises";
import {stdin as input, stdout as output} from "node:process";
import {stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {chromium, type BrowserContext, type Page} from "playwright";
import {ensureDir} from "./lib/files.js";
import {loadManifest, type TutorialScene} from "./manifest.js";

const tutorialDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const confirmation = "I_HAVE_USER_CONFIRMATION";

async function exists(filePath: string): Promise<boolean> {
  try { await stat(filePath); return true; } catch { return false; }
}

export async function headedAuth(profile: string, url: string, suppliedConfirmation?: string): Promise<void> {
  if (suppliedConfirmation !== confirmation) throw new Error(`Refusing headed login without --confirm-headed-login=${confirmation}`);
  if (!/^[a-z0-9-]+$/.test(profile)) throw new Error("Auth profile must use lowercase letters, numbers, and hyphens");
  const authDir = path.join(tutorialDir, ".auth");
  const statePath = path.join(authDir, `${profile}.storageState.json`);
  await ensureDir(authDir);
  const browser = await chromium.launch({headless: false, channel: "chrome"});
  const context = await browser.newContext({
    storageState: await exists(statePath) ? statePath : undefined,
    viewport: {width: 1920, height: 1080},
  });
  const page = await context.newPage();
  await page.goto(url);
  const terminal = createInterface({input, output});
  await terminal.question("Complete login personally in the browser. No recording is active. Press Enter only after the destination page is fully loaded. ");
  terminal.close();
  await context.storageState({path: statePath});
  await context.close();
  await browser.close();
  console.log(`Saved ignored auth state: ${statePath}`);
}

function assertAllowedHost(url: string, allowedHosts: string[]): void {
  const host = new URL(url).hostname;
  if (!allowedHosts.includes(host)) throw new Error(`Capture navigated to unapproved host: ${host}`);
}

export function remainingSceneHoldMs(durationSeconds: number, startedAtMs: number, nowMs: number): number {
  return Math.max(0, Math.round(durationSeconds * 1000) - (nowMs - startedAtMs));
}

export function approvedRecipientFromTexts(texts: string[], allowedEmails: string[]): string {
  const presentedEmails = [...new Set(texts
    .map((text) => text.trim().toLowerCase())
    .filter((text) => /^[^\s@]+@[^\s@]+$/.test(text)))];
  if (presentedEmails.length !== 1 || !allowedEmails.map((email) => email.toLowerCase()).includes(presentedEmails[0])) {
    throw new Error(`Refusing send: visible connected mailbox is not the single manifest-allowed recipient`);
  }
  return presentedEmails[0];
}

async function applyMasks(page: Page, selectors: string[]): Promise<void> {
  if (selectors.length === 0) return;
  await page.addStyleTag({content: selectors.map((selector) => `${selector}{filter:blur(18px)!important;color:transparent!important;text-shadow:none!important}`).join("\n")});
}

export async function captureLive(
  manifestPath: string,
  suppliedConfirmation?: string,
  mailboxConfirmation?: string,
  sendConfirmation?: string,
  sceneId?: string,
): Promise<void> {
  const {manifest} = await loadManifest(manifestPath);
  if (manifest.capturePolicy.mode !== "live-approved-only") throw new Error("Capture accepts only a reviewed live-approved-only manifest");
  if (manifest.capturePolicy.requireActionTimeConfirmation && suppliedConfirmation !== confirmation) {
    throw new Error(`Refusing live capture without --confirm-live-capture=${confirmation}`);
  }
  if (manifest.capturePolicy.allowUpload || manifest.capturePolicy.recordCredentials) {
    throw new Error("Unsafe capture policy");
  }
  const captureScenes = manifest.scenes
    .filter((scene): scene is Extract<TutorialScene, {kind: "capture"}> => scene.kind === "capture")
    .filter((scene) => !sceneId || scene.id === sceneId);
  if (captureScenes.length === 0) throw new Error(sceneId ? `No capture scene named ${sceneId}` : "Manifest contains no capture scenes");
  const externalActions = captureScenes.flatMap((scene) =>
    scene.actions.map((action) => "externalAction" in action ? action.externalAction : "none"),
  );
  if (externalActions.includes("mailbox-change")) {
    if (manifest.capturePolicy.allowMailboxChange !== "approval-required" || mailboxConfirmation !== confirmation) {
      throw new Error(`Refusing OAuth/mailbox changes without --confirm-mailbox-change=${confirmation}`);
    }
  }
  if (externalActions.includes("send-email")) {
    if (manifest.capturePolicy.allowSend !== "approval-required" || sendConfirmation !== confirmation) {
      throw new Error(`Refusing email send without --confirm-send=${confirmation}`);
    }
  }
  for (const scene of captureScenes) {
    if (scene.actions.some((action) => action.type === "manual" && action.forbiddenWhileRecording)) {
      throw new Error(`Scene ${scene.id} contains a manual credential step forbidden during recording; complete it with auth:headed first`);
    }
    const statePath = path.join(tutorialDir, ".auth", `${scene.authProfile}.storageState.json`);
    if (!await exists(statePath)) throw new Error(`Missing ignored auth state ${statePath}; run an approved headed login first`);
    const targetDir = path.join(tutorialDir, "output", manifest.id, ".work", "captures");
    await ensureDir(targetDir);
    const browser = await chromium.launch({headless: false, channel: "chrome"});
    let context: BrowserContext | undefined;
    let terminal: ReturnType<typeof createInterface> | undefined;
    try {
      context = await browser.newContext({
        storageState: statePath,
        viewport: {width: manifest.video.width, height: manifest.video.height},
        recordVideo: {dir: targetDir, size: {width: manifest.video.width, height: manifest.video.height}},
      });
      const page = await context.newPage();
      const sceneStartedAt = Date.now();
      terminal = createInterface({input, output});
      for (const action of scene.actions) {
        if (action.type === "goto") {
          assertAllowedHost(action.url, manifest.capturePolicy.allowedHosts);
          await page.goto(action.url, {waitUntil: "networkidle"});
          await applyMasks(page, scene.maskSelectors);
        } else if (action.type === "click") {
          if (/password|credential|secret|token/i.test(action.selector)) throw new Error("Credential selectors are forbidden in capture actions");
          if (action.externalAction === "send-email") {
            const sendButton = page.getByRole("button", {name: "Send test email", exact: true});
            const mailboxCard = sendButton.locator("xpath=ancestor::div[.//code][1]");
            approvedRecipientFromTexts(await mailboxCard.locator("code").allTextContents(), manifest.privacy.allowedEmails);
          }
          await page.locator(action.selector).click();
          await applyMasks(page, scene.maskSelectors);
        } else if (action.type === "waitFor") {
          await page.locator(action.selector).waitFor({state: "visible", timeout: action.timeoutMs});
        } else if (action.type === "scrollIntoView") {
          await page.locator(action.selector).evaluate((element) => element.scrollIntoView({block: "center", inline: "nearest"}));
          await page.waitForTimeout(1_000);
        } else if (action.type === "waitForUrl") {
          await page.waitForURL(action.pattern, {timeout: action.timeoutMs});
          assertAllowedHost(page.url(), manifest.capturePolicy.allowedHosts);
        } else {
          await terminal.question(`${action.instruction} Press Enter to continue. `);
        }
      }
      const remainingHold = remainingSceneHoldMs(scene.durationSeconds, sceneStartedAt, Date.now());
      if (remainingHold > 0) await page.waitForTimeout(remainingHold);
      const video = page.video();
      terminal.close();
      terminal = undefined;
      await context.close();
      context = undefined;
      if (!video) throw new Error("Playwright did not create a video");
      await video.saveAs(path.join(targetDir, `${scene.id}.webm`));
      await video.delete();
    } finally {
      terminal?.close();
      await context?.close().catch(() => undefined);
      await browser.close().catch(() => undefined);
    }
  }
}
