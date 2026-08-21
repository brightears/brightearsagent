import path from "node:path";
import {captureLive, headedAuth} from "./capture.js";
import {loadManifest} from "./manifest.js";
import {qaExisting, runLivePipeline, runPipeline} from "./pipeline.js";

function option(name: string): string | undefined {
  const prefix = `--${name}=`;
  const inline = process.argv.find((arg) => arg.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function positional(): string[] {
  const args = process.argv.slice(3);
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index].startsWith("--") && !args[index].includes("=")) {
      index += 1;
      continue;
    }
    if (!args[index].startsWith("--")) values.push(args[index]);
  }
  return values;
}

async function main(): Promise<void> {
  const command = process.argv[2];
  const args = positional();
  if (command === "validate") {
    const target = args[0] ?? "manifests/sprint0-placeholder.json";
    const {manifest, absolutePath} = await loadManifest(target);
    console.log(`Valid manifest: ${manifest.id} (${path.resolve(absolutePath)})`);
    return;
  }
  if (command === "run") {
    await runPipeline(args[0] ?? "manifests/sprint0-placeholder.json", option("output"));
    return;
  }
  if (command === "run-live") {
    if (!args[0]) throw new Error("Usage: run-live <manifest> [--narration-fallback=say] --sent-email=true");
    const fallback = option("narration-fallback");
    if (fallback && fallback !== "say") throw new Error("Only --narration-fallback=say is supported");
    await runLivePipeline(args[0], option("output"), {sayFallback: fallback === "say", sentEmail: option("sent-email") === "true"});
    return;
  }
  if (command === "qa") {
    await qaExisting(args[0] ?? "manifests/sprint0-placeholder.json", option("output"));
    return;
  }
  if (command === "auth") {
    if (!args[0] || !args[1]) throw new Error("Usage: auth <profile> <login-url> --confirm-headed-login=I_HAVE_USER_CONFIRMATION");
    await headedAuth(args[0], args[1], option("confirm-headed-login"));
    return;
  }
  if (command === "capture") {
    if (!args[0]) throw new Error("Usage: capture <manifest> [--scene=<scene-id>] --confirm-live-capture=I_HAVE_USER_CONFIRMATION");
    await captureLive(args[0], option("confirm-live-capture"), option("confirm-mailbox-change"), option("confirm-send"), option("scene"));
    return;
  }
  throw new Error("Usage: cli.ts <validate|run|run-live|qa|auth|capture> ...");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
