import {mkdtemp, readFile, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {describe, expect, it, vi} from "vitest";
import {buildGoogleTtsRequest, configuredGoogleTtsApiKey, configuredGoogleTtsApiKeyFromFile, synthesizeGoogleTts} from "../src/google-tts.js";

describe("Google Cloud TTS adapter", () => {
  it("builds a Chirp-compatible LINEAR16 request", () => {
    expect(buildGoogleTtsRequest("Hello", "en-US-Chirp3-HD-Aoede")).toEqual({
      input: {text: "Hello"},
      voice: {languageCode: "en-US", name: "en-US-Chirp3-HD-Aoede"},
      audioConfig: {audioEncoding: "LINEAR16"},
    });
  });

  it("accepts only a non-empty dedicated TTS key", () => {
    expect(configuredGoogleTtsApiKey({GOOGLE_CLOUD_TTS_API_KEY: "  secret  "})).toBe("secret");
    expect(configuredGoogleTtsApiKey({GOOGLE_TTS_API_KEY: "fallback"})).toBe("fallback");
    expect(configuredGoogleTtsApiKey({GOOGLE_CLOUD_TTS_API_KEY: " "})).toBeUndefined();
  });

  it("reads only the dedicated key from a local env file", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "bright-ears-tts-env-"));
    const envPath = path.join(directory, ".env.local");
    await writeFile(envPath, "UNRELATED_SECRET=ignore\nGOOGLE_CLOUD_TTS_API_KEY=local-key\n", {mode: 0o600});
    expect(await configuredGoogleTtsApiKeyFromFile(envPath)).toBe("local-key");
  });

  it("writes decoded audio without exposing the key", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "bright-ears-tts-"));
    const outputPath = path.join(directory, "voice.wav");
    let observedUrl = "";
    let observedInit: RequestInit | undefined;
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      observedUrl = String(input);
      observedInit = init;
      return new Response(JSON.stringify({
        audioContent: Buffer.from("audio-bytes").toString("base64"),
      }), {status: 200, headers: {"Content-Type": "application/json"}});
    }) as typeof fetch;

    await synthesizeGoogleTts({text: "Hello", voice: "en-US-Chirp3-HD-Aoede", outputPath, apiKey: "private-key", fetchImpl});

    expect(await readFile(outputPath, "utf8")).toBe("audio-bytes");
    expect(fetchImpl).toHaveBeenCalledOnce();
    expect(observedUrl).toBe("https://texttospeech.googleapis.com/v1/text:synthesize");
    expect((observedInit?.headers as Record<string, string>)["x-goog-api-key"]).toBe("private-key");
    expect(String(observedInit?.body)).not.toContain("private-key");
  });

  it("suppresses the credential when a network request fails", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "bright-ears-tts-error-"));
    const fetchImpl = vi.fn(async () => {
      throw new Error("request for private-key failed");
    }) as unknown as typeof fetch;
    await expect(synthesizeGoogleTts({
      text: "Hello",
      voice: "en-US-Chirp3-HD-Aoede",
      outputPath: path.join(directory, "voice.wav"),
      apiKey: "private-key",
      fetchImpl,
    })).rejects.toThrow("network request failed (credential suppressed)");
  });

  it("suppresses the credential if an HTTP error reflects it", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "bright-ears-tts-http-error-"));
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      error: {message: "private-key is not allowed"},
    }), {status: 403, headers: {"Content-Type": "application/json"}})) as unknown as typeof fetch;

    let message = "";
    try {
      await synthesizeGoogleTts({
        text: "Hello",
        voice: "en-US-Chirp3-HD-Aoede",
        outputPath: path.join(directory, "voice.wav"),
        apiKey: "private-key",
        fetchImpl,
      });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toContain("[credential suppressed] is not allowed");
    expect(message).not.toContain("private-key");
  });
});
