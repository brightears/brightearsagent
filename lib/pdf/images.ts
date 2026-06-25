// Server-side image pre-fetch for PDF embedding. @react-pdf/renderer's <Image>
// can fetch remote URLs itself, but a single broken/slow URL would throw and
// kill the whole render — so we fetch each candidate here with a timeout, verify
// it's a real image under a streamed size cap, and hand the document a data URI
// (or skip it). Robust by construction: a dead photo link just drops out.
//
// SECURITY: photoUrls/socialLinks are TENANT-CONTROLLED and these fetches run
// server-side from inside the trust boundary, so this is an SSRF surface. We
// allow only http/https, block private/loopback/link-local hosts (incl. the
// cloud-metadata IP), do NOT follow redirects (a public host could 302 to an
// internal target), and cap the body by streaming (so a huge/endless response
// can't blow memory before the size check runs).

const MAX_IMAGE_BYTES = 6 * 1024 * 1024;

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 0 || a === 10 || a === 127) return true; // this-host, private, loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  // IPv6 loopback / link-local / unique-local.
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  if (isPrivateIPv4(h)) return true;
  return false;
}

export async function fetchImageDataUri(url: string): Promise<string | null> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (isBlockedHost(parsed.hostname)) return null;

  try {
    const res = await fetch(parsed, { signal: AbortSignal.timeout(6000), redirect: "manual" });
    // Reject redirects outright — a public-looking URL could 302 to an internal host.
    if (res.status >= 300 && res.status < 400) return null;
    if (!res.ok) return null;

    const contentType = (res.headers.get("content-type") ?? "").split(";")[0].trim();
    if (!contentType.startsWith("image/")) return null;

    const declared = Number(res.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > MAX_IMAGE_BYTES) return null;

    // Stream with a hard cap so a body lying about its size can't blow memory.
    const reader = res.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value) {
        total += value.length;
        if (total > MAX_IMAGE_BYTES) {
          await reader.cancel();
          return null;
        }
        chunks.push(value);
      }
    }
    if (total === 0) return null;
    return `data:${contentType};base64,${Buffer.concat(chunks).toString("base64")}`;
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
