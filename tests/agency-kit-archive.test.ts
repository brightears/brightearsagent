import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdir, mkdtemp, rm, symlink, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { strFromU8, unzipSync } from "fflate";
import { buildPromotionKitArchive, MAX_KIT_PHOTO_BYTES } from "@/lib/agency/promotion-kit-archive";
import type { AgencyArtist } from "@/lib/agency/roster";
import curated from "@/lib/agency/roster-assets.json";

const now = new Date("2026-09-11T12:34:56.000Z");
const localImage = curated.photos["dj-benji"].local;
const photo = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aBl8AAAAASUVORK5CYII=", "base64");
const publicArtist = (overrides: Partial<AgencyArtist> = {}): AgencyArtist => ({
  id: "dj-benji", name: "Benji / เบนจิ", city: "Bangkok", genres: ["House", "Disco"],
  bio: "Warm house and disco.\nA public introduction.", bioTh: "เพลงเฮาส์และดิสโก้\nประวัติสำหรับประชาสัมพันธ์",
  image: localImage, gallery: [],
  links: [{ label: "SoundCloud", url: "https://soundcloud.com/public-mix" }, { label: "Instagram", url: "https://instagram.com/public-artist" }],
  ...overrides,
});

let fixture: string;
let publicDirectory: string;
let photoPath: string;
let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  fixture = await mkdtemp(path.join(tmpdir(), "be-kit-archive-"));
  publicDirectory = path.join(fixture, "public");
  photoPath = path.join(publicDirectory, localImage.slice(1));
  await mkdir(path.dirname(photoPath), { recursive: true });
  fetchSpy = vi.fn(() => { throw new Error("Archive must not fetch image URLs"); });
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(fixture, { recursive: true, force: true });
});

describe("promotion kit archive public contents", () => {
  it("unzips to fixed entries, exact bilingual content and original photo bytes without private extras", async () => {
    await writeFile(photoPath, photo);
    const sentinel = "PRIVATE_DO_NOT_EXPORT";
    const artist = {
      ...publicArtist(), contactEmail: sentinel, contactPhone: sentinel, lineId: sentinel,
      realName: sentinel, hourlyRate: sentinel, schedule: [{ venue: sentinel }],
      user: { email: sentinel }, gallery: [`https://agency.brightears.io/${sentinel}.jpg`],
    };
    const archive = await buildPromotionKitArchive(artist, { now, publicDirectory });
    const entries = unzipSync(archive.bytes);
    expect(Object.keys(entries).sort()).toEqual(["README.txt", "artist.txt", "bio-en.txt", "bio-th.txt", "links.txt", "website-photo.png"].sort());
    expect(Buffer.from(entries["website-photo.png"])).toEqual(photo);
    expect(strFromU8(entries["bio-en.txt"])).toBe(artist.bio + "\n");
    expect(strFromU8(entries["bio-th.txt"])).toBe(artist.bioTh + "\n");
    expect(strFromU8(entries["artist.txt"])).toBe("Benji / เบนจิ\nBangkok\nHouse / Disco\n");
    expect(strFromU8(entries["links.txt"])).toBe([
      "Current promotion kit: https://brightears.io/artists/dj-benji/kit",
      "Artist profile: https://brightears.io/artists/dj-benji",
      `Published image: https://brightears.io${localImage}`,
      "SoundCloud: https://soundcloud.com/public-mix",
      "Instagram: https://instagram.com/public-artist", "",
    ].join("\n"));
    const readme = strFromU8(entries["README.txt"]);
    expect(readme).toContain("Prepared: 2026-09-11T12:34:56.000Z");
    expect(readme).toContain("Current kit: https://brightears.io/artists/dj-benji/kit");
    expect(readme).toContain("Included photo: website-photo.png");
    expect(readme).toContain("This download is a snapshot.");
    expect(readme).toContain("สื่อศิลปินสำหรับประชาสัมพันธ์");
    for (const [name, bytes] of Object.entries(entries)) {
      expect(name).not.toMatch(/[\\/]|\.\./);
      expect(Buffer.from(bytes).toString("utf8")).not.toContain(sentinel);
    }
    expect(archive.filename).toBe("bright-ears-dj-benji-promotion-kit-2026-09-11.zip");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("keeps an external image as a source link, without filesystem requirements or network fetching", async () => {
    const image = "https://res.cloudinary.com/public/image/upload/artist.jpg";
    const archive = await buildPromotionKitArchive(publicArtist({ image }), { now, publicDirectory: path.join(fixture, "does-not-exist") });
    const entries = unzipSync(archive.bytes);
    expect(Object.keys(entries).sort()).toEqual(["README.txt", "artist.txt", "bio-en.txt", "bio-th.txt", "links.txt"].sort());
    expect(strFromU8(entries["links.txt"])).toContain(`Published image: ${image}`);
    expect(strFromU8(entries["README.txt"])).toContain("No photo file is included.");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("includes an explicitly mapped supplemental artist photo", async () => {
    const supplemental = curated.supplementalArtists.find(item => item.id === "dj-funktastic");
    expect(supplemental).toBeDefined();
    const supplementalPhotoPath = path.join(publicDirectory, supplemental!.profileImage.slice(1));
    await mkdir(path.dirname(supplementalPhotoPath), { recursive: true });
    await writeFile(supplementalPhotoPath, photo);
    const archive = await buildPromotionKitArchive(publicArtist({
      id: supplemental!.id,
      name: supplemental!.stageName,
      image: supplemental!.profileImage,
    }), { now, publicDirectory });
    const entries = unzipSync(archive.bytes);
    expect(Buffer.from(entries["website-photo.jpg"])).toEqual(photo);
    expect(strFromU8(entries["README.txt"])).toContain("Included photo: website-photo.jpg");
  });

  it.each([
    { id: "unmapped-artist", image: localImage },
    { id: "dj-benji", image: curated.photos["dj-linze"].local },
    { id: "dj-benji", image: "/agency/roster/../../private.png" },
    { id: "dj-benji", image: "/agency/roster/%2e%2e%2fprivate.png" },
  ])("does not read an unapproved artist/image mapping: %j", async overrides => {
    // None of the local image files exist: reading one would reject the archive.
    const archive = await buildPromotionKitArchive(publicArtist(overrides), { now, publicDirectory });
    expect(Object.keys(unzipSync(archive.bytes)).some(name => name.startsWith("website-photo."))).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("omits unavailable languages and image links instead of inventing material", async () => {
    const entries = unzipSync((await buildPromotionKitArchive(publicArtist({ image: null, bio: "", bioTh: "", links: [] }), { now, publicDirectory })).bytes);
    expect(Object.keys(entries).sort()).toEqual(["README.txt", "artist.txt", "links.txt"].sort());
    expect(strFromU8(entries["links.txt"])).not.toContain("Published image:");
    expect(strFromU8(entries["README.txt"])).toContain("No photo file is included.");
  });

  it("bounds UTF-8 text bytes, including multibyte Thai content", async () => {
    const bioTh = "ก".repeat(50_000);
    expect(bioTh.length).toBeLessThan(128 * 1024);
    await expect(buildPromotionKitArchive(publicArtist({ image: null, bioTh }), { now, publicDirectory })).rejects.toThrow("Public kit text too large");
  });
});

describe("promotion kit archive filesystem and identifier boundaries", () => {
  it("refuses a missing curated photo rather than silently claiming it is included", async () => {
    await expect(buildPromotionKitArchive(publicArtist(), { now, publicDirectory })).rejects.toThrow();
  });

  it("refuses an oversized local photo", async () => {
    await writeFile(photoPath, photo);
    await truncate(photoPath, MAX_KIT_PHOTO_BYTES + 1);
    await expect(buildPromotionKitArchive(publicArtist(), { now, publicDirectory })).rejects.toThrow("Public image unavailable");
  });

  it("refuses a directory in place of the curated image file", async () => {
    await mkdir(photoPath);
    await expect(buildPromotionKitArchive(publicArtist(), { now, publicDirectory })).rejects.toThrow("Public image unavailable");
  });

  it("refuses a photo symlink that escapes the public agency directory", async () => {
    const privateFile = path.join(fixture, "private-canary.png");
    await writeFile(privateFile, "PRIVATE_DO_NOT_EXPORT");
    await symlink(privateFile, photoPath);
    await expect(buildPromotionKitArchive(publicArtist(), { now, publicDirectory })).rejects.toThrow("Invalid public image path");
  });

  it("refuses an agency-directory symlink that moves the trusted root outside public", async () => {
    const outsideAgency = path.join(fixture, "private-agency");
    await mkdir(path.join(outsideAgency, "roster"), { recursive: true });
    await writeFile(path.join(outsideAgency, "roster", path.basename(photoPath)), "PRIVATE_DO_NOT_EXPORT");
    await rm(path.join(publicDirectory, "agency"), { recursive: true });
    await symlink(outsideAgency, path.join(publicDirectory, "agency"));
    await expect(buildPromotionKitArchive(publicArtist(), { now, publicDirectory })).rejects.toThrow();
  });

  it.each(["", "../secret", "%2e%2e%2fsecret", "artist/name", "artist\\name", "dj\r\nX-Injected: yes", "ก", "a".repeat(81)])("rejects unsafe artist id %j before building filenames", async id => {
    await expect(buildPromotionKitArchive(publicArtist({ id, image: null }), { now, publicDirectory })).rejects.toThrow("Invalid public artist identifier");
  });
});
