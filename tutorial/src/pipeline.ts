import {readFile, stat, writeFile} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
import {bundle} from "@remotion/bundler";
import {renderMedia, renderStill, selectComposition} from "@remotion/renderer";
import type {TutorialManifest, TutorialScene} from "./manifest.js";
import {loadManifest, totalDurationSeconds} from "./manifest.js";
import {copyWithDirs, ensureDir, formatTimestamp, sha256File, sha256Text, writeJson} from "./lib/files.js";
import {run} from "./lib/process.js";
import type {TutorialProps} from "./remotion/tutorial.js";

const tutorialDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const repoDir = path.resolve(tutorialDir, "..");

type StageName = "validate" | "prepare" | "narrate" | "compose" | "package" | "qa";
interface PipelineState {
  manifestSha256: string;
  stages: Partial<Record<StageName, {status: "complete"; completedAt: string; fingerprint: string}>>;
}

interface Paths {
  root: string;
  work: string;
  narration: string;
  video: string;
  thumbnail: string;
  subtitles: string;
  chapters: string;
  metadata: string;
  qa: string;
  state: string;
}

interface NarrationAsset {
  path: string;
  durationSeconds: number;
}

interface PipelineOptions {
  allowLiveCapture: boolean;
  sayFallback: boolean;
  sentEmail: boolean;
}

const defaultPipelineOptions: PipelineOptions = {
  allowLiveCapture: false,
  sayFallback: false,
  sentEmail: false,
};

function pathsFor(root: string): Paths {
  return {
    root,
    work: path.join(root, ".work"),
    narration: path.join(root, ".work", "narration.wav"),
    video: path.join(root, "tutorial.mp4"),
    thumbnail: path.join(root, "thumbnail.png"),
    subtitles: path.join(root, "subtitles.srt"),
    chapters: path.join(root, "chapters.txt"),
    metadata: path.join(root, "metadata.json"),
    qa: path.join(root, "qa-report.json"),
    state: path.join(root, "state.json"),
  };
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readState(paths: Paths, manifestSha256: string): Promise<PipelineState> {
  if (!await exists(paths.state)) return {manifestSha256, stages: {}};
  try {
    const state = JSON.parse(await readFile(paths.state, "utf8")) as PipelineState;
    return state.manifestSha256 === manifestSha256 ? state : {manifestSha256, stages: {}};
  } catch {
    return {manifestSha256, stages: {}};
  }
}

async function stage(
  state: PipelineState,
  paths: Paths,
  name: StageName,
  fingerprint: string,
  outputs: string[],
  action: () => Promise<void>,
): Promise<void> {
  const prior = state.stages[name];
  if (prior?.fingerprint === fingerprint && (await Promise.all(outputs.map(exists))).every(Boolean)) {
    console.log(`[resume] ${name}`);
    return;
  }
  console.log(`[run] ${name}`);
  await action();
  state.stages[name] = {status: "complete", completedAt: new Date().toISOString(), fingerprint};
  await writeJson(paths.state, state);
}

function assertRuntime(): void {
  const major = Number(process.versions.node.split(".")[0]);
  if (major !== 22) throw new Error(`Node 22 is required; current runtime is ${process.version}`);
}

async function audioDuration(filePath: string): Promise<number> {
  const value = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath], {quiet: true});
  const duration = Number(value);
  if (!Number.isFinite(duration)) throw new Error(`Could not probe audio duration: ${filePath}`);
  return duration;
}

async function mediaDuration(filePath: string): Promise<number> {
  const value = await run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath], {quiet: true});
  const duration = Number(value);
  if (!Number.isFinite(duration)) throw new Error(`Could not probe media duration: ${filePath}`);
  return duration;
}

function captureScenes(manifest: TutorialManifest): Array<Extract<TutorialScene, {kind: "capture"}>> {
  return manifest.scenes.filter((scene): scene is Extract<TutorialScene, {kind: "capture"}> => scene.kind === "capture");
}

async function prepareCaptureMedia(manifest: TutorialManifest, paths: Paths): Promise<void> {
  const editedDir = path.join(paths.work, "edited");
  await ensureDir(editedDir);
  for (const scene of captureScenes(manifest)) {
    const source = path.join(paths.work, "captures", `${scene.id}.webm`);
    if (!await exists(source)) throw new Error(`Missing reviewed capture source: ${source}`);
    const sourceDuration = await mediaDuration(source);
    const segments = scene.editSegments ?? [{startSeconds: 0, durationSeconds: Math.min(scene.durationSeconds, sourceDuration)}];
    for (const segment of segments) {
      if (segment.startSeconds + segment.durationSeconds > sourceDuration + 0.05) {
        throw new Error(`Edit segment for ${scene.id} exceeds its ${sourceDuration.toFixed(3)}s capture source`);
      }
    }
    const editedDuration = segments.reduce((sum, segment) => sum + segment.durationSeconds, 0);
    const freezeTail = scene.durationSeconds - editedDuration;
    const args = ["-y"];
    for (const segment of segments) {
      args.push("-ss", String(segment.startSeconds), "-t", String(segment.durationSeconds), "-i", source);
    }
    const filters = segments.map((_, index) =>
      `[${index}:v]scale=${manifest.video.width}:${manifest.video.height}:force_original_aspect_ratio=decrease,` +
      `pad=${manifest.video.width}:${manifest.video.height}:(ow-iw)/2:(oh-ih)/2,` +
      `fps=${manifest.video.fps},setsar=1,setpts=PTS-STARTPTS[v${index}]`,
    );
    filters.push(`${segments.map((_, index) => `[v${index}]`).join("")}concat=n=${segments.length}:v=1:a=0[joined]`);
    filters.push(`[joined]tpad=stop_mode=clone:stop_duration=${freezeTail.toFixed(3)},trim=duration=${scene.durationSeconds},setpts=PTS-STARTPTS[video]`);
    const target = path.join(editedDir, `${scene.id}.mp4`);
    args.push(
      "-filter_complex", filters.join(";"),
      "-map", "[video]", "-an", "-c:v", "libx264", "-preset", "medium", "-crf", "16",
      "-pix_fmt", "yuv420p", "-profile:v", "high", "-movflags", "+faststart", target,
    );
    await run("ffmpeg", args, {quiet: true});
  }
}

async function narrate(manifest: TutorialManifest, paths: Paths, sayFallback: boolean): Promise<NarrationAsset[]> {
  if (manifest.narration.provider !== "say" && !sayFallback) {
    throw new Error("Google Cloud TTS is intentionally not activated in Sprint 0. Configure ADC and implement the reviewed provider adapter before publication narration.");
  }
  const voice = manifest.narration.provider === "say" ? manifest.narration.voice : "Samantha";
  const dir = path.join(paths.work, "scenes");
  await ensureDir(dir);
  const assets: NarrationAsset[] = [];
  for (const scene of manifest.scenes) {
    const target = path.join(dir, `${scene.id}.aiff`);
    await run("/usr/bin/say", ["-v", voice, "-r", String(manifest.narration.rate ?? 175), "-o", target, scene.narration], {quiet: true});
    const durationSeconds = await audioDuration(target);
    if (durationSeconds > scene.durationSeconds - 0.45) {
      throw new Error(`Narration for ${scene.id} is ${durationSeconds.toFixed(2)}s but the scene is ${scene.durationSeconds.toFixed(2)}s`);
    }
    assets.push({path: target, durationSeconds});
  }
  return assets;
}

async function buildNarrationTrack(manifest: TutorialManifest, assets: NarrationAsset[], output: string): Promise<void> {
  const total = totalDurationSeconds(manifest);
  const args = ["-y", "-f", "lavfi", "-t", String(total), "-i", "anullsrc=r=48000:cl=stereo"];
  for (const asset of assets) args.push("-i", asset.path);
  let offset = 0;
  const filters: string[] = [];
  const labels: string[] = ["[0:a]"];
  manifest.scenes.forEach((scene, index) => {
    const delay = Math.round((offset + 0.3) * 1000);
    filters.push(`[${index + 1}:a]aresample=48000,aformat=channel_layouts=stereo,adelay=${delay}|${delay}[n${index}]`);
    labels.push(`[n${index}]`);
    offset += scene.durationSeconds;
  });
  filters.push(`${labels.join("")}amix=inputs=${labels.length}:duration=first:normalize=0,alimiter=limit=0.95[narration]`);
  args.push("-filter_complex", filters.join(";"), "-map", "[narration]", "-t", String(total), "-c:a", "pcm_s16le", output);
  await run("ffmpeg", args, {quiet: true});
}

async function renderVisuals(manifest: TutorialManifest, paths: Paths): Promise<void> {
  const scenes: TutorialProps["scenes"] = [];
  let startFrame = 0;
  for (const scene of manifest.scenes) {
    const durationInFrames = Math.round(scene.durationSeconds * manifest.video.fps);
    scenes.push({
      id: scene.id,
      kind: scene.kind,
      title: scene.title,
      eyebrow: scene.eyebrow,
      bullets: scene.bullets,
      startFrame,
      durationInFrames,
      mediaPath: scene.kind === "capture" ? `edited/${scene.id}.mp4` : undefined,
    });
    startFrame += durationInFrames;
  }
  const inputProps: TutorialProps = {title: manifest.title, scenes};
  const serveUrl = await bundle({entryPoint: path.join(tutorialDir, "src", "remotion", "index.ts"), publicDir: paths.work});
  const composition = await selectComposition({serveUrl, id: "Tutorial", inputProps});
  const visual = path.join(paths.work, "visual.mp4");
  await renderMedia({
    composition,
    serveUrl,
    codec: "h264",
    outputLocation: visual,
    inputProps,
    chromiumOptions: {gl: "angle"},
    concurrency: 2,
  });
  await renderStill({
    composition,
    serveUrl,
    output: paths.thumbnail,
    frame: Math.min(42, composition.durationInFrames - 1),
    inputProps,
    imageFormat: "png",
    chromiumOptions: {gl: "angle"},
  });
}

async function createMusic(manifest: TutorialManifest, paths: Paths): Promise<string | null> {
  if (!manifest.music.enabled) return null;
  if (manifest.music.mode === "file") {
    const source = path.resolve(path.dirname(paths.root), manifest.music.path!);
    if (!await exists(source)) throw new Error(`Music source does not exist: ${source}`);
    return source;
  }
  const target = path.join(paths.work, "procedural-test-music.wav");
  const total = totalDurationSeconds(manifest);
  await run("ffmpeg", [
    "-y", "-f", "lavfi", "-i", `sine=frequency=220:sample_rate=48000:duration=${total}`,
    "-f", "lavfi", "-i", `sine=frequency=330:sample_rate=48000:duration=${total}`,
    "-filter_complex", "[0:a]volume=0.20[a0];[1:a]volume=0.12[a1];[a0][a1]amix=inputs=2:normalize=0,afade=t=in:st=0:d=1,afade=t=out:st=" + Math.max(0, total - 1) + ":d=1[music]",
    "-map", "[music]", "-c:a", "pcm_s16le", target,
  ], {quiet: true});
  return target;
}

async function mixPackage(manifest: TutorialManifest, paths: Paths, music: string | null): Promise<void> {
  const visual = path.join(paths.work, "visual.mp4");
  if (!music) {
    await run("ffmpeg", ["-y", "-i", visual, "-i", paths.narration, "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", paths.video], {quiet: true});
    return;
  }
  await run("ffmpeg", [
    "-y", "-i", visual, "-i", paths.narration, "-i", music,
    "-filter_complex", "[2:a]volume=0.07[music];[music][1:a]sidechaincompress=threshold=0.015:ratio=8:attack=20:release=350[ducked];[1:a]volume=1.0[narr];[ducked][narr]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.95[audio]",
    "-map", "0:v:0", "-map", "[audio]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-shortest", paths.video,
  ], {quiet: true});
}

async function writeTextArtifacts(manifest: TutorialManifest, assets: NarrationAsset[], paths: Paths): Promise<void> {
  let offset = 0;
  const srt: string[] = [];
  const chapters: string[] = [];
  manifest.scenes.forEach((scene, index) => {
    const start = offset + 0.3;
    const end = Math.min(offset + scene.durationSeconds - 0.2, start + assets[index].durationSeconds);
    srt.push(String(index + 1), `${formatTimestamp(start)} --> ${formatTimestamp(end)}`, scene.narration, "");
    chapters.push(`${formatTimestamp(offset, ".").slice(0, 8)} ${scene.chapter}`);
    offset += scene.durationSeconds;
  });
  await writeFile(paths.subtitles, `${srt.join("\n").trim()}\n`, "utf8");
  await writeFile(paths.chapters, `${chapters.join("\n")}\n`, "utf8");
}

async function probeJson(filePath: string): Promise<{streams: Array<Record<string, unknown>>; format: Record<string, string>}> {
  return JSON.parse(await run("ffprobe", ["-v", "error", "-show_streams", "-show_format", "-of", "json", filePath], {quiet: true}));
}

export async function qaPackage(manifest: TutorialManifest, paths: Paths): Promise<{passed: boolean; checks: Array<{name: string; passed: boolean; detail: string}>}> {
  const video = await probeJson(paths.video);
  const thumbnail = await probeJson(paths.thumbnail);
  const videoStream = video.streams.find((stream) => stream.codec_type === "video");
  const audioStream = video.streams.find((stream) => stream.codec_type === "audio");
  const thumbnailStream = thumbnail.streams.find((stream) => stream.codec_type === "video");
  const actualDuration = Number(video.format.duration);
  const expectedDuration = totalDurationSeconds(manifest);
  const chapters = await readFile(paths.chapters, "utf8");
  const subtitles = await readFile(paths.subtitles, "utf8");
  const metadata = await readFile(paths.metadata, "utf8");
  const parsedMetadata = JSON.parse(metadata) as {artifacts?: Record<string, {file?: string; sha256?: string}>};
  const text = `${chapters}\n${subtitles}\n${metadata}`;
  const forbidden = manifest.privacy.forbiddenTextPatterns.filter((pattern) => new RegExp(pattern, "i").test(text));
  const subtitleCueCount = subtitles.trim().split(/\n\s*\n/).filter(Boolean).length;
  const chapterLines = chapters.trim().split("\n");
  const chapterSeconds = chapterLines.map((line) => {
    const match = /^(\d{2}):(\d{2}):(\d{2}) /.exec(line);
    return match ? Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) : Number.NaN;
  });
  const chaptersMonotonic = chapterSeconds.every((seconds, index) => Number.isFinite(seconds) && (index === 0 ? seconds === 0 : seconds > chapterSeconds[index - 1]));
  const artifactFiles: Record<string, string> = {video: paths.video, thumbnail: paths.thumbnail, subtitles: paths.subtitles, chapters: paths.chapters};
  const hashResults = await Promise.all(Object.entries(artifactFiles).map(async ([key, filePath]) => ({
    key,
    matches: parsedMetadata.artifacts?.[key]?.file === path.basename(filePath) && parsedMetadata.artifacts?.[key]?.sha256 === await sha256File(filePath),
  })));
  const checks = [
    {name: "video dimensions", passed: videoStream?.width === manifest.video.width && videoStream?.height === manifest.video.height, detail: `${videoStream?.width}x${videoStream?.height}`},
    {name: "frame rate", passed: videoStream?.r_frame_rate === `${manifest.video.fps}/1`, detail: String(videoStream?.r_frame_rate)},
    {name: "video codec", passed: videoStream?.codec_name === "h264", detail: String(videoStream?.codec_name)},
    {name: "audio codec", passed: audioStream?.codec_name === "aac", detail: String(audioStream?.codec_name)},
    {name: "duration", passed: Math.abs(actualDuration - expectedDuration) <= 0.35, detail: `${actualDuration.toFixed(3)}s expected ${expectedDuration.toFixed(3)}s`},
    {name: "thumbnail dimensions", passed: thumbnailStream?.width === manifest.video.width && thumbnailStream?.height === manifest.video.height, detail: `${thumbnailStream?.width}x${thumbnailStream?.height}`},
    {name: "subtitles", passed: subtitles.includes("00:00:") && subtitleCueCount === manifest.scenes.length, detail: `${subtitleCueCount} cues`},
    {name: "chapters", passed: chaptersMonotonic && chapterLines.length === manifest.scenes.length, detail: `${chapterLines.length} monotonic chapters`},
    {name: "artifact hashes", passed: hashResults.every((result) => result.matches), detail: hashResults.map((result) => `${result.key}:${result.matches ? "ok" : "mismatch"}`).join(", ")},
    {name: "secret-like text", passed: forbidden.length === 0, detail: forbidden.length === 0 ? "none found" : forbidden.join(", ")},
    {name: "human review gate", passed: manifest.privacy.requireHumanFrameReview, detail: "publication remains blocked pending human frame review"},
  ];
  return {passed: checks.every((check) => check.passed), checks};
}

export async function resolvePipeline(manifestPath: string, outputArg?: string): Promise<{manifest: TutorialManifest; paths: Paths; manifestSha256: string; absoluteManifest: string}> {
  assertRuntime();
  const {manifest, absolutePath} = await loadManifest(manifestPath);
  const root = path.resolve(outputArg ?? path.join(tutorialDir, "output", manifest.id));
  await ensureDir(root);
  return {manifest, paths: pathsFor(root), manifestSha256: await sha256File(absolutePath), absoluteManifest: absolutePath};
}

export async function runPipeline(
  manifestPath: string,
  outputArg?: string,
  options: PipelineOptions = defaultPipelineOptions,
): Promise<Paths> {
  const {manifest, paths, manifestSha256, absoluteManifest} = await resolvePipeline(manifestPath, outputArg);
  const state = await readState(paths, manifestSha256);
  const isLiveCapture = manifest.capturePolicy.mode === "live-approved-only";
  const captureInputs = captureScenes(manifest).map((scene) => path.join(paths.work, "captures", `${scene.id}.webm`));
  const captureInputFingerprint = isLiveCapture
    ? sha256Text((await Promise.all(captureInputs.map(sha256File))).join("|"))
    : "none";
  const implementationFiles = [
    "package-lock.json",
    "src/capture.ts",
    "src/manifest.ts",
    "src/pipeline.ts",
    "src/remotion/index.ts",
    "src/remotion/root.tsx",
    "src/remotion/tutorial.tsx",
  ].map((relativePath) => path.join(tutorialDir, relativePath));
  const implementationFingerprint = sha256Text((await Promise.all(implementationFiles.map(sha256File))).join("|"));
  const baseFingerprint = sha256Text(`${manifestSha256}|implementation=${implementationFingerprint}|captures=${captureInputFingerprint}|options=${JSON.stringify(options)}|node=${process.version}|remotion=4.0.512`);
  await stage(state, paths, "validate", baseFingerprint, [paths.state], async () => {
    if (isLiveCapture && !options.allowLiveCapture) throw new Error("The default run command accepts synthetic-only manifests. Use run-live only after the separately approved capture workflow.");
    if (!isLiveCapture && options.allowLiveCapture) throw new Error("run-live accepts only a reviewed live-approved-only manifest");
    await ensureDir(paths.work);
  });

  if (isLiveCapture) {
    const editedOutputs = captureScenes(manifest).map((scene) => path.join(paths.work, "edited", `${scene.id}.mp4`));
    await stage(state, paths, "prepare", sha256Text(`${baseFingerprint}|capture-edits=v1`), editedOutputs, async () => {
      await prepareCaptureMedia(manifest, paths);
    });
  }

  let assets: NarrationAsset[] = [];
  await stage(state, paths, "narrate", sha256Text(`${baseFingerprint}|narration=${JSON.stringify(manifest.narration)}|sayFallback=${options.sayFallback}`), manifest.scenes.map((scene) => path.join(paths.work, "scenes", `${scene.id}.aiff`)), async () => {
    assets = await narrate(manifest, paths, options.sayFallback);
  });
  if (assets.length === 0) {
    assets = await Promise.all(manifest.scenes.map(async (scene) => {
      const audioPath = path.join(paths.work, "scenes", `${scene.id}.aiff`);
      return {path: audioPath, durationSeconds: await audioDuration(audioPath)};
    }));
  }

  await stage(state, paths, "compose", sha256Text(`${baseFingerprint}|visual=v2`), [path.join(paths.work, "visual.mp4"), paths.thumbnail], async () => {
    await renderVisuals(manifest, paths);
  });

  await stage(state, paths, "package", sha256Text(`${baseFingerprint}|package=v2|music=${JSON.stringify(manifest.music)}`), [paths.video, paths.thumbnail, paths.subtitles, paths.chapters, paths.metadata], async () => {
    await buildNarrationTrack(manifest, assets, paths.narration);
    const music = await createMusic(manifest, paths);
    await mixPackage(manifest, paths, music);
    await writeTextArtifacts(manifest, assets, paths);
    const gitCommit = await run("git", ["rev-parse", "HEAD"], {cwd: repoDir, quiet: true});
    const versions = {
      node: process.version,
      remotion: "4.0.512",
      playwright: "1.62.1",
      ffmpeg: (await run("ffmpeg", ["-version"], {quiet: true})).split("\n")[0],
    };
    const captureProvenance = await Promise.all(captureScenes(manifest).map(async (scene) => {
      const filePath = path.join(paths.work, "captures", `${scene.id}.webm`);
      return {
        sceneId: scene.id,
        file: path.relative(paths.root, filePath),
        sha256: await sha256File(filePath),
        editSegments: scene.editSegments ?? null,
      };
    }));
    const actualNarration = manifest.narration.provider === "say"
      ? manifest.narration
      : options.sayFallback
        ? {provider: "say", voice: "Samantha", intendedPublicationProvider: manifest.narration}
        : manifest.narration;
    await copyWithDirs(absoluteManifest, path.join(paths.work, "manifest.input.json"));
    await writeJson(paths.metadata, {
      schemaVersion: 1,
      tutorial: {id: manifest.id, title: manifest.title, description: manifest.description, locale: manifest.locale, audience: manifest.metadata.audience, tags: manifest.metadata.tags},
      render: {...manifest.video, durationSeconds: totalDurationSeconds(manifest)},
      provenance: {
        gitCommit,
        manifest: {path: path.relative(repoDir, absoluteManifest), sha256: manifestSha256},
        sources: manifest.sources,
        captures: captureProvenance,
        music: manifest.music,
        narration: {...actualNarration, note: options.sayFallback ? "Review-cut fallback. Publication narration still requires reviewed Google Cloud TTS output." : undefined},
        tools: versions,
      },
      safety: {
        captureMode: manifest.capturePolicy.mode,
        sentEmail: options.sentEmail,
        uploaded: false,
        containsLiveProductCapture: isLiveCapture,
        humanReviewRequired: true,
      },
      artifacts: {
        video: {file: path.basename(paths.video), sha256: await sha256File(paths.video)},
        thumbnail: {file: path.basename(paths.thumbnail), sha256: await sha256File(paths.thumbnail)},
        subtitles: {file: path.basename(paths.subtitles), sha256: await sha256File(paths.subtitles)},
        chapters: {file: path.basename(paths.chapters), sha256: await sha256File(paths.chapters)},
      },
    });
  });

  await stage(state, paths, "qa", sha256Text(`${baseFingerprint}|qa=v3|video=${await sha256File(paths.video)}`), [paths.qa], async () => {
    const report = await qaPackage(manifest, paths);
    await writeJson(paths.qa, {...report, checkedAt: new Date().toISOString()});
    if (!report.passed) throw new Error(`QA failed: ${report.checks.filter((check) => !check.passed).map((check) => check.name).join(", ")}`);
  });
  console.log(`Green package: ${paths.root}`);
  return paths;
}

export async function runLivePipeline(
  manifestPath: string,
  outputArg: string | undefined,
  options: {sayFallback: boolean; sentEmail: boolean},
): Promise<Paths> {
  return await runPipeline(manifestPath, outputArg, {
    allowLiveCapture: true,
    sayFallback: options.sayFallback,
    sentEmail: options.sentEmail,
  });
}

export async function qaExisting(manifestPath: string, outputArg?: string): Promise<void> {
  const {manifest, paths} = await resolvePipeline(manifestPath, outputArg);
  const report = await qaPackage(manifest, paths);
  await writeJson(paths.qa, {...report, checkedAt: new Date().toISOString()});
  if (!report.passed) throw new Error("QA failed");
  console.log(`QA passed: ${paths.qa}`);
}
