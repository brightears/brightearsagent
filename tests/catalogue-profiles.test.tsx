import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
vi.mock("@/lib/db", () => ({ db: {} }));
import { catalogueLink, catalogueProfileSchema, privateTextIssue, toAgencyArtist } from "@/lib/agency/catalogue";
import { buildAgencyRoster, type AgencyArtist } from "@/lib/agency/roster";
import { ArtistCatalogue } from "@/components/artist-catalogue";
import { ArtistProfile } from "@/components/artist-profile";

const row = {
  slug: "fixture-sax", stageName: "Fixture Sax", actLabelEn: "Sax & DJ", actLabelTh: "แซกโซโฟนและดีเจ", actType: "dj_live", actTags: ["sax", "dj"],
  bioEn: "Fixture Sax plays saxophone live over his own DJ sets.", bioTh: "", genres: ["House"], basedIn: "pattaya",
  links: [{ label: "YouTube", url: "https://www.youtube.com/@fixture" }, { label: "Evil", url: "https://evil.example/x" }],
  photoSha256: "a".repeat(64), photoCredit: "Fixture Studio", playedForBrightEars: false,
};
const valid = {
  applicationRef: "BE-APP-11111111-2222-4333-8444-555555555555", slug: "fixture-sax", stageName: "Fixture Sax",
  actLabel: { en: "Sax & DJ", th: "แซกโซโฟนและดีเจ" }, actType: "dj_live", actTags: ["sax"], basedIn: "bangkok",
  bio: { en: "Fixture Sax plays saxophone live over his own DJ sets, from bossa nova to house." },
};

describe("catalogue profile contract", () => {
  it("accepts a complete profile and links only the artist's own sound, video and social pages", () => {
    expect(catalogueProfileSchema.safeParse({ ...valid, links: ["https://youtu.be/abc", "https://www.instagram.com/fixture"] }).success).toBe(true);
    expect(catalogueLink("https://evil.example/instagram.com")).toBeNull();
    expect(catalogueLink("http://www.youtube.com/@fixture")).toBeNull();
    expect(catalogueProfileSchema.safeParse({ ...valid, links: ["https://linktr.ee/fixture"] }).success).toBe(false);
  });
  it("refuses fields that are never public and text that looks like contact details, ID numbers or fees", () => {
    for (const extra of [{ email: "a@b.co" }, { fee: "2500" }, { legalName: "X" }, { rightToWork: "x" }, { consent: true }]) {
      expect(catalogueProfileSchema.safeParse({ ...valid, ...extra }).success).toBe(false);
    }
    expect(privateTextIssue("Write to fixture@example.invalid")).toBe("contact");
    expect(privateTextIssue("LINE ID fixture")).toBe("contact");
    expect(privateTextIssue("โทร 081-234-5678")).toBe("contact");
    expect(privateTextIssue("ID 1101234567890")).toBe("id_number");
    expect(privateTextIssue("฿3,000 a night")).toBe("fee");
    expect(privateTextIssue("Ten years at hotels, rooftops and weddings")).toBeNull();
  });
  it("turns a stored row into exactly the public fields", () => {
    const artist = toAgencyArtist(row, "/api/agency/catalogue/photo/fixture-sax");
    expect(Object.keys(artist).sort()).toEqual(["actLabel", "actTags", "actType", "basedIn", "bio", "bioTh", "city", "gallery", "genres", "id", "image", "links", "name", "photoCredit", "played", "source"]);
    expect(artist.links).toEqual([{ label: "YouTube", url: "https://www.youtube.com/@fixture" }]);
    expect(artist.bioTh).toBe(row.bioEn);
    expect(artist.city).toBe("Pattaya");
  });
});

describe("roster artists on /artists", () => {
  it("tags roster artists, keeps where they are based and marks only artists with sets on record", () => {
    const roster = buildAgencyRoster([
      { id: "dj-benji", stageName: "Benji", category: "DJ", baseCity: "Bangkok", profileImage: "https://res.cloudinary.com/x/benji.jpg" },
      { id: "dj-lupo", stageName: "Lupo", category: "DJ", baseCity: "Hua Hin", profileImage: "https://res.cloudinary.com/x/lupo.jpg" },
    ]);
    const benji = roster.find(a => a.id === "dj-benji")!, lupo = roster.find(a => a.id === "dj-lupo")!;
    expect([benji.played, benji.actTags, benji.basedIn, benji.source]).toEqual([true, ["dj"], "bangkok", "roster"]);
    expect([lupo.played, lupo.basedIn]).toEqual([false, "hua_hin"]);
  });
});

const catalogueArtist: AgencyArtist = toAgencyArtist(row, "/api/agency/catalogue/photo/fixture-sax");
const rosterArtist: AgencyArtist = { id: "dj-benji", name: "Benji", bio: "", bioTh: "", city: "Bangkok", genres: ["House"], image: "https://res.cloudinary.com/x/b.jpg", gallery: [], links: [], actType: "dj", source: "roster", actTags: ["dj"], basedIn: "bangkok", played: true };

describe("catalogue and profile pages", () => {
  it("shows roster and catalogue artists together with act and based-in filters and one played marker", () => {
    const html = renderToStaticMarkup(<ArtistCatalogue artists={[rosterArtist, catalogueArtist]} th={false}/>);
    expect(html).toContain("Fixture Sax");
    expect(html).toContain("Benji");
    expect(html).toContain(">Saxophone</option>");
    expect(html).toContain(">Pattaya</option>");
    expect(html.match(/Has played for Bright Ears/g)).toHaveLength(1);
    const th = renderToStaticMarkup(<ArtistCatalogue artists={[rosterArtist, catalogueArtist]} th/>);
    expect(th).toContain(">แซกโซโฟน</option>");
    expect(th).toContain("ศิลปินอยู่ที่");
  });
  it("renders the preview exactly as the profile, with a banner and no enquiry or kit links", () => {
    const live = renderToStaticMarkup(<ArtistProfile artist={catalogueArtist} related={[]} th={false}/>);
    const preview = renderToStaticMarkup(<ArtistProfile artist={catalogueArtist} related={[]} th={false} preview="draft"/>);
    expect(preview).toContain("this profile is not public yet");
    expect(preview).not.toContain("href=\"/?artists=");
    for (const html of [live, preview]) {
      expect(html).toContain("Photo: Fixture Studio");
      expect(html).toContain("Pattaya / Sax &amp; DJ");
      expect(html).not.toContain("/kit");
    }
    expect(live).toContain("href=\"/?artists=fixture-sax#brief\"");
    expect(renderToStaticMarkup(<ArtistProfile artist={rosterArtist} related={[]} th={false}/>)).toContain("/artists/dj-benji/kit");
  });
});
