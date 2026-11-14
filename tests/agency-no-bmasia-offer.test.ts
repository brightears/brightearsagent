import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Owner decision, 11 Nov 2026: brightears.io is a DJ and live-music agency.
// Background music, playback and its scheduling are BMAsia's business, so the
// public agency pages must not offer them or mention BMAsia or its products.
const root = path.resolve(__dirname, "..");
const files = (dir: string): string[] =>
  readdirSync(path.join(root, dir)).flatMap(name => {
    const rel = path.join(dir, name);
    return statSync(path.join(root, rel)).isDirectory() ? files(rel) : /\.(tsx?|txt|md)$/.test(name) ? [rel] : [];
  });

const publicSources = [
  ...files("app/(marketing)"),
  ...files("components").filter(f => /components\/agency-/.test(f)),
  "public/llms.txt",
];

const forbidden = /beat\s?breeze|beatbreeze\.io|bm\s?asia|soundtrack your brand|background music|เพลงพื้นหลัง|ดนตรีพื้นหลัง|บีเอ็มเอเชีย/i;

describe("public agency pages", () => {
  it("do not mention BMAsia, Beat Breeze or background music", () => {
    const hits = publicSources.flatMap(file =>
      readFileSync(path.join(root, file), "utf8")
        .split("\n")
        .map((line, i) => (forbidden.test(line) ? `${file}:${i + 1}` : null))
        .filter((hit): hit is string => hit !== null),
    );
    expect(hits).toEqual([]);
  });
});
