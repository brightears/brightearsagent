import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Hero photos are display copies (artist kits use public/agency/roster/). On
// 11 Nov 2026 two camera originals (13 MB and 7.4 MB) made the city-page hero
// slow, because the image resizer had to decode them on the first request.
// Keep display copies small; full-quality files belong in the roster kit.
const dir = path.resolve(__dirname, "..", "public/agency/hero");
const MAX_BYTES = 3 * 1024 * 1024;

describe("hero display photos", () => {
  it("stay under 3 MB each", () => {
    const heavy = readdirSync(dir)
      .filter(name => /\.(jpe?g|png|webp)$/i.test(name))
      .map(name => ({ name, bytes: statSync(path.join(dir, name)).size }))
      .filter(file => file.bytes > MAX_BYTES)
      .map(file => `${file.name} (${(file.bytes / 1048576).toFixed(1)} MB)`);
    expect(heavy).toEqual([]);
  });
});
