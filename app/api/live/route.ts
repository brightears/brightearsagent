/**
 * Process liveness for Render.
 *
 * Keep this handler deliberately shallow: it must prove only that the Next.js
 * process can accept and answer an HTTP request. Database, configuration and
 * background-job readiness belong to /api/health so a downstream outage cannot
 * make Render recycle an otherwise healthy web process.
 */
export function GET() {
  return Response.json(
    { ok: true },
    {
      status: 200,
      headers: { "Cache-Control": "no-store, max-age=0" },
    },
  );
}
