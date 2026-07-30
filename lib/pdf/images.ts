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

/**
 * Per-image ceiling for the press kit.
 *
 * Was 6 MB, which let ONE phone photo produce a 5.5 MB PDF — and profile
 * strength requires THREE photos, so a completed profile would build a ~20 MB
 * attachment that Postmark refuses outright (see MAX_ATTACHMENT_BYTES in
 * lib/outbound/send.ts, where the reply is now protected from that).
 *
 * 2 MB comfortably fits a good web-resolution photo while making a
 * refuses-to-send press kit arithmetically impossible.
 *
 * THIS IS A CEILING, NOT THE REAL FIX. The right answer is to downscale on
 * UPLOAD — one resize when the artist adds the photo, instead of rejecting
 * their camera-original later. That is deliberately not done here: it needs
 * `sharp`, which is currently only a TRANSITIVE dependency via Next, and a
 * production send path must not rest on a package that is not in the manifest.
 * Add sharp explicitly, resize in the R2 upload path, then this can go back up.
 */
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

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
  let h = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  // IPv4-mapped IPv6 (::ffff:10.0.0.1) hides a v4 address — unwrap it (14.4).
  h = h.replace(/^::ffff:/, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  // IPv6 loopback / link-local / unique-local.
  if (h === "::1" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  if (isPrivateIPv4(h)) return true;
  return false;
}

/**
 * DNS re-check (14.4): a harmless-looking NAME can resolve straight to a
 * private/metadata address — resolve every A/AAAA record and re-run the
 * same blocklist against the actual IPs. Unresolvable = don't fetch.
 * Injectable resolver for tests.
 */
export async function resolvesToBlockedIp(
  hostname: string,
  lookupFn?: (host: string) => Promise<{ address: string }[]>,
): Promise<boolean> {
  // Literal IPs were already judged by isBlockedHost — only names resolve.
  if (/^[\d.]+$/.test(hostname) || hostname.includes(":")) return false;
  try {
    const lookup =
      lookupFn ??
      (async (host: string) => {
        const dns = await import("node:dns/promises");
        return dns.lookup(host, { all: true, verbatim: true });
      });
    const addrs = await lookup(hostname);
    if (addrs.length === 0) return true;
    return addrs.some((a) => isBlockedHost(a.address));
  } catch {
    return true; // can't resolve = can't verify = don't fetch
  }
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
  // 14.4: the hostname LOOKS public — verify what it actually resolves to.
  // KNOWN LIMITATION (P15 review, accepted): this is a check-then-fetch, and
  // fetch() re-resolves the name, so a DNS-rebinding attacker who flips the
  // record between our lookup and fetch's could still reach an internal IP.
  // Fully closing it needs connection-level IP pinning (a custom undici
  // dispatcher/lookup), which Next's global fetch doesn't expose cleanly. The
  // exposure is bounded: the fetch is GET-only, no-redirect, 6s-capped, and
  // only image/* under 6MB is ever read — no response body is surfaced to the
  // attacker, so this is a low-value blind SSRF, not data exfiltration.
  if (await resolvesToBlockedIp(parsed.hostname)) return null;

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
