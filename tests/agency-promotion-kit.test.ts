import { describe, expect, it } from "vitest";
import { localKitDownload } from "@/components/agency-promotion-kit";

describe("promotion-kit photo downloads", () => {
  it("uses the published local file with an honest, safe download name", () => {
    expect(localKitDownload("/agency/roster/benji-photo1.png", "dj-benji")).toEqual({
      href: "/agency/roster/benji-photo1.png",
      filename: "dj-benji-website-photo.png",
    });
    const filename = localKitDownload("/agency/hero/dj-ufo.jpg", "../unsafe/name")?.filename;
    expect(filename).not.toContain("/");
    expect(filename).not.toContain("..");
  });

  it.each([
    null,
    "https://agency.brightears.io/images/djs/benji-photo1.png",
    "//other.example/agency/roster/photo.png",
    "/agency/roster/../../private.png",
    "/agency/roster/%2e%2e%2fprivate.png",
    "/agency/roster/photo.png?redirect=https://other.example",
    "/agency/roster/photo.svg",
    "/api/venue-portal/schedule/pdf",
  ])("never offers a download for an external or unexpected path: %s", image => {
    expect(localKitDownload(image, "dj-benji")).toBeNull();
  });
});
