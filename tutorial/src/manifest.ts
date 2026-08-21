import {readFile} from "node:fs/promises";
import path from "node:path";
import {z} from "zod";

const provenanceSchema = z.object({
  source: z.string().min(1),
  license: z.string().min(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/).optional(),
});

const externalActionSchema = z.enum(["none", "mailbox-change", "send-email"]);

const actionSchema = z.discriminatedUnion("type", [
  z.object({type: z.literal("goto"), url: z.string().url()}),
  z.object({type: z.literal("click"), selector: z.string().min(1), externalAction: externalActionSchema.default("none")}),
  z.object({type: z.literal("waitFor"), selector: z.string().min(1), timeoutMs: z.number().int().positive().max(60_000).default(15_000)}),
  z.object({type: z.literal("scrollIntoView"), selector: z.string().min(1)}),
  z.object({type: z.literal("waitForUrl"), pattern: z.string().min(1), timeoutMs: z.number().int().positive().max(60_000).default(30_000)}),
  z.object({type: z.literal("manual"), instruction: z.string().min(1), forbiddenWhileRecording: z.boolean().default(false), externalAction: externalActionSchema.default("none")}),
]);

const baseScene = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  durationSeconds: z.number().positive().max(120),
  chapter: z.string().min(1),
  narration: z.string().min(1),
  title: z.string().min(1),
  eyebrow: z.string().min(1).optional(),
  bullets: z.array(z.string().min(1)).max(5).default([]),
});

const editSegmentSchema = z.object({
  startSeconds: z.number().nonnegative().max(600),
  durationSeconds: z.number().positive().max(120),
});

const sceneSchema = z.discriminatedUnion("kind", [
  baseScene.extend({kind: z.literal("synthetic")}),
  baseScene.extend({
    kind: z.literal("capture"),
    authProfile: z.string().regex(/^[a-z0-9-]+$/),
    actions: z.array(actionSchema).min(1),
    maskSelectors: z.array(z.string().min(1)).default([]),
    editSegments: z.array(editSegmentSchema).min(1).optional(),
  }),
]);

export const tutorialManifestSchema = z.object({
  schemaVersion: z.literal(1),
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: z.string().min(1),
  description: z.string().min(1),
  locale: z.string().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/),
  video: z.object({
    width: z.literal(1920),
    height: z.literal(1080),
    fps: z.literal(30),
  }),
  narration: z.object({
    provider: z.enum(["say", "google-cloud-tts"]),
    voice: z.string().min(1),
    rate: z.number().int().min(120).max(240).optional(),
  }),
  music: z.discriminatedUnion("enabled", [
    z.object({enabled: z.literal(false)}),
    z.object({
      enabled: z.literal(true),
      mode: z.enum(["procedural-test-tone", "file"]),
      path: z.string().min(1).optional(),
      provenance: provenanceSchema,
    }),
  ]),
  capturePolicy: z.object({
    mode: z.enum(["synthetic-only", "live-approved-only"]),
    requireActionTimeConfirmation: z.boolean(),
    allowedHosts: z.array(z.string().min(1)),
    recordCredentials: z.literal(false),
    allowMailboxChange: z.enum(["never", "approval-required"]),
    allowSend: z.enum(["never", "approval-required"]),
    allowUpload: z.literal(false),
  }),
  privacy: z.object({
    allowedEmails: z.array(z.string().email()).default([]),
    forbiddenTextPatterns: z.array(z.string().min(1)).min(1),
    requireHumanFrameReview: z.literal(true),
  }),
  sources: z.array(provenanceSchema).default([]),
  scenes: z.array(sceneSchema).min(1),
  metadata: z.object({
    audience: z.string().min(1),
    tags: z.array(z.string().min(1)).max(20),
  }),
}).superRefine((manifest, context) => {
  const hasCapture = manifest.scenes.some((scene) => scene.kind === "capture");
  if (manifest.capturePolicy.mode === "synthetic-only" && hasCapture) {
    context.addIssue({code: "custom", path: ["scenes"], message: "synthetic-only manifests cannot contain capture scenes"});
  }
  if (hasCapture && !manifest.capturePolicy.requireActionTimeConfirmation) {
    context.addIssue({code: "custom", path: ["capturePolicy", "requireActionTimeConfirmation"], message: "live capture must require action-time confirmation"});
  }
  if (manifest.music.enabled && manifest.music.mode === "file" && !manifest.music.path) {
    context.addIssue({code: "custom", path: ["music", "path"], message: "licensed file music requires a path"});
  }
  manifest.scenes.forEach((scene, index) => {
    if (scene.kind === "capture" && scene.editSegments) {
      const editedDuration = scene.editSegments.reduce((sum, segment) => sum + segment.durationSeconds, 0);
      if (editedDuration > scene.durationSeconds) {
        context.addIssue({code: "custom", path: ["scenes", index, "editSegments"], message: "capture edit segments exceed the scene duration"});
      }
    }
  });
});

export type TutorialManifest = z.infer<typeof tutorialManifestSchema>;
export type TutorialScene = TutorialManifest["scenes"][number];

export async function loadManifest(filePath: string): Promise<{manifest: TutorialManifest; absolutePath: string}> {
  const absolutePath = path.resolve(filePath);
  const raw = await readFile(absolutePath, "utf8");
  return {manifest: tutorialManifestSchema.parse(JSON.parse(raw)), absolutePath};
}

export function totalDurationSeconds(manifest: TutorialManifest): number {
  return manifest.scenes.reduce((sum, scene) => sum + scene.durationSeconds, 0);
}
