/** Only curated public-site image paths can become file downloads. */
export function localKitDownload(image: string | null, id: string): { href: string; filename: string } | null {
  if (!image || !/^\/agency\/(?:roster\/|hero\/)?[a-z0-9_-]+\.(?:png|jpe?g|webp)$/i.test(image)) return null;
  const extension = image.split(".").at(-1)!.toLowerCase();
  return { href: image, filename: `${id.replace(/[^a-z0-9_-]/gi, "-").slice(0,80) || "artist"}-website-photo.${extension}` };
}

export const PUBLIC_KIT_ORIGIN = "https://brightears.io";
export const isPublicArtistId = (id: string) => /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(id);
