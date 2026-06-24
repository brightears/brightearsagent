// Client-safe upload limits — shared by the presign route (server) and the
// uploader component (client) so validation can't drift. No AWS/server imports
// here, so this is safe to bundle into the browser.

/** Accepted image content-types, mapped to the extension we store under. */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB — generous for a photo

export const MAX_PHOTOS = 12; // the useful ceiling (GigSalad/The Bash guidance)
