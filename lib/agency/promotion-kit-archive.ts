import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { strToU8, zipSync, type Zippable } from "fflate";
import curated from "./roster-assets.json";
import type { AgencyArtist } from "./roster";
import { isPublicArtistId, localKitDownload, PUBLIC_KIT_ORIGIN } from "./promotion-kit";

export const MAX_KIT_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_KIT_TEXT_BYTES = 128 * 1024;

/** A snapshot of the same explicit public fields used by the kit page.
 * Never serializes an Artist record or fetches a remote image. */
export async function buildPromotionKitArchive(
  artist: AgencyArtist,
  { now = new Date(), publicDirectory = path.join(process.cwd(), "public") }:
  { now?: Date; publicDirectory?: string } = {},
) {
  if (!isPublicArtistId(artist.id)) throw new Error("Invalid public artist identifier");
  const kitUrl = `${PUBLIC_KIT_ORIGIN}/artists/${encodeURIComponent(artist.id)}/kit`;
  const photoSource = artist.image?.startsWith("/") ? PUBLIC_KIT_ORIGIN + artist.image : artist.image;
  const mapped = (curated.photos as Record<string, { local: string }>)[artist.id];
  const supplemental = (curated.supplementalArtists as Array<{ id: string; profileImage?: string; images?: string[] }> | undefined)
    ?.find(item => item.id === artist.id);
  const approvedLocalImage = mapped?.local ?? supplemental?.profileImage;
  const local = approvedLocalImage === artist.image ? localKitDownload(artist.image, artist.id) : null;
  const additionalPhotos = (local ? (supplemental?.images ?? []) : [])
    .filter(image => artist.gallery.includes(image))
    .map(image => localKitDownload(image, artist.id))
    .filter((image): image is NonNullable<typeof image> => image !== null);
  const entries: Zippable = {};
  let photoName: string | null = null;
  const additionalNames: string[] = [];

  if (local || additionalPhotos.length) {
    // The URL comes from this artist's checked-in mapping, not a request path.
    // Real paths also prevent a public-directory symlink from exporting secrets.
    // Scoped assets are listed in outputFileTracingIncludes. The optional
    // directory is for isolated filesystem checks, not a request parameter.
    const publicRoot = await realpath(/* turbopackIgnore: true */ publicDirectory);
    const root = await realpath(path.join(publicRoot, "agency"));
    const rootRelative = path.relative(publicRoot, root);
    if (!rootRelative || rootRelative.startsWith("..") || path.isAbsolute(rootRelative)) throw new Error("Invalid public image root");
    for (const [index, image] of [local, ...additionalPhotos].filter((value): value is NonNullable<typeof value> => value !== null).entries()) {
      const file = await realpath(/* turbopackIgnore: true */ path.join(/* turbopackIgnore: true */ publicDirectory, image.href.slice(1)));
      const relative = path.relative(root, file);
      if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error("Invalid public image path");
      const metadata = await stat(file);
      if (!metadata.isFile() || metadata.size > MAX_KIT_PHOTO_BYTES) throw new Error("Public image unavailable");
      const bytes = await readFile(file);
      if (bytes.byteLength > MAX_KIT_PHOTO_BYTES) throw new Error("Public image too large");
      const filename = `website-photo${index ? `-${index + 1}` : ""}.${image.href.split(".").at(-1)!.toLowerCase()}`;
      if (index === 0) photoName = filename;
      else additionalNames.push(filename);
      // Published PNG/JPEG/WebP files are already compressed.
      entries[filename] = [bytes, { level: 0, mtime: now }];
    }
  }

  const textFiles: Record<string, string> = {
    "README.txt": [
      "BRIGHT EARS / ARTIST PROMOTION KIT",
      artist.name,
      `Prepared: ${now.toISOString()}`,
      `Current kit: ${kitUrl}`,
      "",
      "Public artist material for venue and event marketing.",
      photoName ? `Included photo: ${photoName} (the published website image).` : "No photo file is included. Any published image is linked in links.txt.",
      ...additionalNames.map(name => `Additional photo: ${name} (published artist image).`),
      "Available public biographies are included in their original languages.",
      "This download is a snapshot. Use the current kit link for updates.",
      "For a larger or uncropped photo, another format or a photographer credit, contact Bright Ears.",
      "",
      "สื่อศิลปินสำหรับประชาสัมพันธ์สถานที่และงานอีเวนต์",
      photoName ? "ภาพที่แนบเป็นไฟล์ที่เผยแพร่บนเว็บไซต์" : "ไม่มีไฟล์ภาพแนบในชุดนี้ ดูลิงก์ภาพที่เผยแพร่ได้ใน links.txt",
      "ไฟล์ชุดนี้เป็นข้อมูล ณ วันที่จัดเตรียม ดูข้อมูลล่าสุดได้ที่ลิงก์ชุดสื่อด้านบน",
      "หากต้องการภาพขนาดใหญ่ ภาพไม่ครอป รูปแบบไฟล์อื่น หรือเครดิตช่างภาพ โปรดติดต่อ Bright Ears",
      "",
      "Bright Ears: https://page.line.me/944grjuq",
      "Email: norbert@brightears.io",
    ].join("\n") + "\n",
    "artist.txt": [artist.name, artist.city, artist.genres.join(" / ")].filter(Boolean).join("\n") + "\n",
    "links.txt": [
      `Current promotion kit: ${kitUrl}`,
      `Artist profile: ${PUBLIC_KIT_ORIGIN}/artists/${encodeURIComponent(artist.id)}`,
      ...(photoSource ? [`Published image: ${photoSource}`] : []),
      ...additionalPhotos.map(image => `Additional published image: ${PUBLIC_KIT_ORIGIN}${image.href}`),
      ...artist.links.map(link => `${link.label}: ${link.url}`),
    ].join("\n") + "\n",
    ...(artist.bio ? { "bio-en.txt": artist.bio + "\n" } : {}),
    ...(artist.bioTh ? { "bio-th.txt": artist.bioTh + "\n" } : {}),
  };
  let textBytes = 0;
  for (const [filename, value] of Object.entries(textFiles)) {
    const bytes = strToU8(value);
    textBytes += bytes.byteLength;
    if (textBytes > MAX_KIT_TEXT_BYTES) throw new Error("Public kit text too large");
    entries[filename] = [bytes, { level: 6, mtime: now }];
  }
  return {
    bytes: zipSync(entries),
    filename: `bright-ears-${artist.id}-promotion-kit-${now.toISOString().slice(0, 10)}.zip`,
  };
}
