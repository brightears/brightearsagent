import { NextRequest, NextResponse } from "next/server";

/**
 * Compatibility shim for the agency stack's LINE push endpoint.
 *
 * WHY THIS EXISTS (live incident, 2026-07-27). Until the apex cutover,
 * brightears.io served the agency app, and everything that pushes LINE messages
 * for the agency — the cron, a typed wrapper, an MCP server — has that absolute
 * URL baked in. The apex now serves THIS app, which has no /api/line/*, so
 * every one of those callers started getting a 404: no DJ shift reminders, no
 * venue feedback cards, no manual group messages. Inbound LINE was unaffected
 * (its webhook was re-registered during the cutover), which is exactly why the
 * failure was invisible — LINE looked healthy from the outside.
 *
 * A redirect cannot fix this: a 301/302 on a POST is replayed as a GET with the
 * body dropped, and a cross-origin hop strips the Authorization header these
 * callers rely on. So we forward server-side instead, preserving method, body,
 * content type, the bearer token and the ?key= fallback.
 *
 * This grants no new access. Authorization is enforced ENTIRELY by the agency
 * endpoint (LINE_PUSH_API_KEY, as bearer or ?key=); we only relay whatever
 * credential the caller already supplied, so an unauthenticated request still
 * gets a 401 from the other side. The target is a hardcoded constant — nothing
 * about the request can redirect it elsewhere.
 *
 * TRANSITIONAL. Remove once every agency caller points at agency.brightears.io
 * directly. Until then, deleting this file silently breaks Vinyl's outbound.
 */
const AGENCY_PUSH_URL = "https://agency.brightears.io/api/line/push";
const TIMEOUT_MS = 15_000;

export async function POST(req: NextRequest) {
  const body = await req.text();

  const target = new URL(AGENCY_PUSH_URL);
  const key = req.nextUrl.searchParams.get("key");
  if (key) target.searchParams.set("key", key);

  const headers: Record<string, string> = {
    "content-type": req.headers.get("content-type") ?? "application/json",
  };
  const auth = req.headers.get("authorization");
  if (auth) headers.authorization = auth;

  try {
    const res = await fetch(target, {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const text = await res.text();
    return new NextResponse(text, {
      status: res.status,
      headers: { "content-type": res.headers.get("content-type") ?? "application/json" },
    });
  } catch (err) {
    // 502, never a silent 200: the agency cron treats a non-ok response as a
    // failure it can log, and a fake success here would hide the outage again.
    console.error(
      JSON.stringify({
        level: "error",
        kind: "line_push_proxy_failed",
        message: err instanceof Error ? err.message : String(err),
        ts: new Date().toISOString(),
      }),
    );
    return NextResponse.json({ error: "line push upstream unreachable" }, { status: 502 });
  }
}
