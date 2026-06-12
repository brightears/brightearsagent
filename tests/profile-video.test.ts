import { describe, expect, it } from "vitest";
import { videoEmbedUrl } from "@/lib/profile/video";

describe("videoEmbedUrl", () => {
  it("converts youtube watch/short/embed/youtu.be URLs", () => {
    expect(videoEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(videoEmbedUrl("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    expect(videoEmbedUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
  });

  it("converts vimeo URLs", () => {
    expect(videoEmbedUrl("https://vimeo.com/123456789")).toBe(
      "https://player.vimeo.com/video/123456789",
    );
  });

  it("rejects everything else — the EPK never iframes arbitrary URLs", () => {
    expect(videoEmbedUrl("https://evil.test/watch?v=abc12345")).toBeNull();
    expect(videoEmbedUrl("https://youtube.com.evil.test/watch?v=abc12345")).toBeNull();
    expect(videoEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(videoEmbedUrl("not a url")).toBeNull();
    expect(videoEmbedUrl("https://vimeo.com/about")).toBeNull();
  });
});
