import {readFile, writeFile} from "node:fs/promises";
import {parseEnv} from "node:util";

export const googleTtsApiKeyEnvironmentNames = [
  "GOOGLE_CLOUD_TTS_API_KEY",
  "GOOGLE_TTS_API_KEY",
] as const;

interface GoogleTtsRequest {
  input: {text: string};
  voice: {languageCode: string; name: string};
  audioConfig: {audioEncoding: "LINEAR16"};
}

interface SynthesizeOptions {
  text: string;
  voice: string;
  outputPath: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

function languageCodeForVoice(voice: string): string {
  const [language, region] = voice.split("-");
  if (!language || !region) throw new Error(`Google Cloud TTS voice has no language code: ${voice}`);
  return `${language}-${region}`;
}

function suppressCredential(value: string, credential: string): string {
  return value.split(credential).join("[credential suppressed]");
}

export function buildGoogleTtsRequest(text: string, voice: string): GoogleTtsRequest {
  return {
    input: {text},
    voice: {languageCode: languageCodeForVoice(voice), name: voice},
    audioConfig: {audioEncoding: "LINEAR16"},
  };
}

export function configuredGoogleTtsApiKey(environment: NodeJS.ProcessEnv = process.env): string | undefined {
  for (const name of googleTtsApiKeyEnvironmentNames) {
    const value = environment[name]?.trim();
    if (value) return value;
  }
  return undefined;
}

export async function configuredGoogleTtsApiKeyFromFile(filePath: string): Promise<string | undefined> {
  try {
    return configuredGoogleTtsApiKey(parseEnv(await readFile(filePath, "utf8")));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
}

export async function synthesizeGoogleTts(options: SynthesizeOptions): Promise<void> {
  const apiKey = options.apiKey?.trim() || configuredGoogleTtsApiKey();
  if (!apiKey) {
    throw new Error(
      "Google Cloud TTS needs GOOGLE_CLOUD_TTS_API_KEY in tutorial/.env.local (ignored by git). " +
      "Do not put the key in the manifest, source code, terminal command, or chat.",
    );
  }

  let response: Response;
  try {
    response = await (options.fetchImpl ?? fetch)(
      "https://texttospeech.googleapis.com/v1/text:synthesize",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify(buildGoogleTtsRequest(options.text, options.voice)),
      },
    );
  } catch {
    throw new Error("Google Cloud TTS network request failed (credential suppressed)");
  }

  let payload: {audioContent?: string; error?: {message?: string}};
  try {
    payload = await response.json() as typeof payload;
  } catch {
    throw new Error(`Google Cloud TTS returned an invalid HTTP ${response.status} response`);
  }
  if (!response.ok || !payload.audioContent) {
    const detail = suppressCredential(payload.error?.message ?? `HTTP ${response.status}`, apiKey);
    throw new Error(`Google Cloud TTS synthesis failed: ${detail}`);
  }

  const audio = Buffer.from(payload.audioContent, "base64");
  if (audio.length === 0) throw new Error("Google Cloud TTS returned empty audio");
  await writeFile(options.outputPath, audio, {mode: 0o600});
}
