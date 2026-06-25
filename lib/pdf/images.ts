// Server-side image pre-fetch for PDF embedding. @react-pdf/renderer's <Image>
// can fetch remote URLs itself, but a single broken/slow URL would throw and
// kill the whole render — so we fetch each candidate here with a timeout, verify
// it's a real image under a size cap, and hand the document a data URI (or skip
// it). Robust by construction: a dead photo link just drops out.

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

export async function fetchImageDataUri(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000), redirect: "follow" });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!contentType.startsWith("image/")) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0 || buf.length > MAX_IMAGE_BYTES) return null;
    return `data:${contentType};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Fetch up to `max` images concurrently, preserving order, dropping failures. */
export async function fetchImageDataUris(urls: string[], max: number): Promise<string[]> {
  const picked = urls.slice(0, max);
  const results = await Promise.all(picked.map(fetchImageDataUri));
  return results.filter((d): d is string => d !== null);
}
