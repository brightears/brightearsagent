// Browser-side photo preparation for /join. Phone cameras produce 3 to 15 MB
// files; the server accepts at most MAX_PHOTO_BYTES. Redrawing the photo at
// PHOTO_MAX_EDGE pixels and saving it as JPEG brings it to about 0.5 to 1.5 MB
// and leaves out data stored in the file, such as location.
import { MAX_PHOTO_BYTES, MAX_PHOTO_SOURCE_BYTES, PHOTO_MAX_EDGE, PHOTO_TYPES } from "./application-contract";

export type PreparedPhoto = { file: File } | { error: "type" | "size" };

/** Width and height that fit inside `edge` pixels on the long side, never enlarged. */
export function fitWithin(width: number, height: number, edge = PHOTO_MAX_EDGE) {
  const scale = Math.min(1, edge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

/** Loads the file into an <img>, which applies the camera's orientation, so the photo is drawn upright. */
function load(url: string): Promise<HTMLImageElement> {
  // The load event, not image.decode(): decode() waits for a rendered frame and
  // never settles in a tab that is not painting (seen in a hidden browser pane).
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("unreadable"));
    image.src = url;
  });
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return Promise.race([work, new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms))]);
}

async function redraw(file: File, maxBytes: number): Promise<File | null> {
  const url = URL.createObjectURL(file);
  try {
    const image = await load(url);
    const { width, height } = fitWithin(image.naturalWidth, image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.fillStyle = "#ffffff"; // transparent PNG areas become white, not black
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);
    for (const quality of [0.86, 0.76, 0.62]) {
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/jpeg", quality));
      if (blob && blob.size <= maxBytes) {
        const name = (file.name.replace(/\.[^.]*$/, "") || "photo").slice(0, 80) + ".jpg";
        return new File([blob], name, { type: "image/jpeg" });
      }
    }
    return null;
  } finally { URL.revokeObjectURL(url); }
}

export async function preparePhoto(file: File, maxBytes = MAX_PHOTO_BYTES): Promise<PreparedPhoto> {
  if (file.size > MAX_PHOTO_SOURCE_BYTES) return { error: "size" };
  try {
    const resized = await withTimeout(redraw(file, maxBytes), 20_000);
    if (resized) return { file: resized };
  } catch { /* fall through: send the original if the server can take it */ }
  if (!(file.type in PHOTO_TYPES)) return { error: "type" };
  return file.size <= maxBytes ? { file } : { error: "size" };
}
