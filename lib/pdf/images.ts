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

function parseIPv4(host: string): [number, number, number, number] | null {
  const parts = host.split(".");
  if (
    parts.length !== 4 ||
    parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)
  ) return null;
  return parts.map(Number) as [number, number, number, number];
}

function isPrivateIPv4(host: string): boolean {
  const octets = parseIPv4(host);
  if (!octets) return false;
  const [a, b] = octets;
  if (a === 0 || a === 10 || a === 127) return true; // this-host, private, loopback
  if (a === 169 && b === 254) return true; // link-local + cloud metadata (169.254.169.254)
  if (a === 172 && b >= 16 && b <= 31) return true; // private
  if (a === 192 && b === 168) return true; // private
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  return false;
}

/** Expand an IPv6 literal to eight hextets, including dotted-v4 tails. */
function parseIPv6(host: string): number[] | null {
  let value = host.toLowerCase().replace(/^\[|\]$/g, "");
  if (!value.includes(":") || value.includes("%")) return null;

  if (value.includes(".")) {
    const colon = value.lastIndexOf(":");
    if (colon < 0) return null;
    const ipv4 = parseIPv4(value.slice(colon + 1));
    if (!ipv4) return null;
    const high = (ipv4[0] << 8) | ipv4[1];
    const low = (ipv4[2] << 8) | ipv4[3];
    value = `${value.slice(0, colon)}:${high.toString(16)}:${low.toString(16)}`;
  }

  if (value.split("::").length > 2) return null;
  const compressed = value.includes("::");
  const [leftRaw, rightRaw = ""] = value.split("::");
  const parseSide = (side: string): number[] | null => {
    if (!side) return [];
    const tokens = side.split(":");
    if (tokens.some((token) => !/^[0-9a-f]{1,4}$/.test(token))) return null;
    return tokens.map((token) => Number.parseInt(token, 16));
  };
  const left = parseSide(leftRaw);
  const right = parseSide(rightRaw);
  if (!left || !right) return null;
  const explicit = left.length + right.length;
  if ((!compressed && explicit !== 8) || (compressed && explicit >= 8)) return null;
  return compressed
    ? [...left, ...Array<number>(8 - explicit).fill(0), ...right]
    : left;
}

function isBlockedIPv6(parts: number[]): boolean {
  if (parts.length !== 8) return true;
  const [first] = parts;
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d) forms.
  const mapped = parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff;
  const compatible = parts.slice(0, 6).every((part) => part === 0);
  const translated =
    parts.slice(0, 4).every((part) => part === 0) &&
    parts[4] === 0xffff &&
    parts[5] === 0;
  const wellKnownNat64 =
    parts[0] === 0x64 &&
    parts[1] === 0xff9b &&
    parts.slice(2, 6).every((part) => part === 0);
  if (mapped || compatible || translated || wellKnownNat64) {
    const ipv4 = `${parts[6]! >> 8}.${parts[6]! & 0xff}.${parts[7]! >> 8}.${parts[7]! & 0xff}`;
    return isPrivateIPv4(ipv4);
  }
  if ((first! & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((first! & 0xfe00) === 0xfc00) return true; // unique-local fc00::/7
  if ((first! & 0xff00) === 0xff00) return true; // multicast ff00::/8
  if ((first! & 0xffc0) === 0xfec0) return true; // deprecated site-local fec0::/10
  return false;
}

export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, ""); // strip IPv6 brackets
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) {
    return true;
  }
  const ipv4 = parseIPv4(h);
  if (ipv4) return isPrivateIPv4(h);
  if (/^[\d.]+$/.test(h)) return true; // malformed IPv4-looking literal
  if (h.includes(":")) {
    const ipv6 = parseIPv6(h);
    return ipv6 === null || isBlockedIPv6(ipv6);
  }
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
  const literal = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (parseIPv4(literal) || parseIPv6(literal)) return false;
  if (/^[\d.]+$/.test(literal) || literal.includes(":")) return true;
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
  // only image/* under 2MB is ever read — no response body is surfaced to the
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
