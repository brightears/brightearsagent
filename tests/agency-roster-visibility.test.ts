import { describe, expect, it } from "vitest";
import { buildAgencyRoster, sanitizeArtist } from "@/lib/agency/roster";

const artist = (id: string, stageName = id, profileImage: string | null = "/images/djs/portrait.jpg") => ({ id, stageName, profileImage });

describe("public agency roster", () => {
  it("withholds profiles with no usable lead photo from every shared roster consumer", () => {
    expect(sanitizeArtist(artist("new-no-photo", "New artist", null))).toBeNull();
    expect(sanitizeArtist(artist("new-bad-photo", "New artist", "http://unsafe.example/photo.jpg"))).toBeNull();
    expect(sanitizeArtist(artist("new-photo"))?.image).toBe("https://agency.brightears.io/images/djs/portrait.jpg");
  });

  it.each(["dj-telemaggy", "dj-ize", "dj-dj-mint", "dj-nun", "dj-jj"])("keeps owner-hidden artist %s out even when the upstream service supplies a photo", id => {
    expect(buildAgencyRoster([artist(id)]).some(a => a.id === id)).toBe(false);
  });

  it("places the chosen artists first while retaining Camilo and Enjoy later", () => {
    const ids = ["dj-camilo", "dj-dj-enjoy", "dj-april", "dj-yui-truluv", "dj-fen", "dj-rabbitdisco", "dj-joyyly"];
    const roster = buildAgencyRoster(ids.map(id => artist(id)));
    expect(roster.slice(0, 4).map(a => a.id)).toEqual(["dj-joyyly", "dj-rabbitdisco", "dj-fen", "dj-yui-truluv"]);
    for (const id of ["dj-camilo", "dj-dj-enjoy"]) expect(roster.findIndex(a => a.id === id)).toBeGreaterThan(3);
  });

  it("uses only one profile when a supplemental artist also comes from the upstream service", () => {
    expect(buildAgencyRoster([artist("dj-fen")]).filter(a => a.id === "dj-fen")).toHaveLength(1);
  });
});
