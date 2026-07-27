import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer pulls in native-ish deps (yoga wasm, fontkit) that must
  // not pass through the bundler — keep it external so it's required at runtime.
  serverExternalPackages: ["@react-pdf/renderer"],

  // Apex-cutover redirects (audit 2026-07-27). When brightears.io changes hands,
  // the venues who have been using the agency site for years still hold bookmarks
  // and LINE messages pointing at these paths — without this they land on this
  // app's 404 with no way to guess where their portal went. Transitional 307s,
  // never 301: a browser-cached permanent redirect on your own apex cannot be
  // taken back. Deliberately NOT redirected: /sign-in (belongs to THIS app's
  // Clerk on the apex now — sending it off-domain is a self-inflicted auth
  // outage), /api/line/* (LINE does not follow redirects and cross-origin
  // strips the cron's Authorization header — fixed at the source instead), and
  // the retired marketing URLs (a 404 is the honest signal; funnelling them to
  // a SaaS homepage is the soft-404 pattern search engines penalise).
  async redirects() {
    const agency = "https://agency.brightears.io";
    return [
      { source: "/venue-portal/:path*", destination: `${agency}/venue-portal/:path*`, permanent: false },
      { source: "/:locale(en|th)/venue-portal/:path*", destination: `${agency}/:locale/venue-portal/:path*`, permanent: false },
      { source: "/venue-onboarding/:path*", destination: `${agency}/venue-onboarding/:path*`, permanent: false },
      { source: "/dj-portal/:path*", destination: `${agency}/dj-portal/:path*`, permanent: false },
      { source: "/liff/:path*", destination: `${agency}/liff/:path*`, permanent: false },
      // www must follow the apex or the two hosts serve different applications.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.brightears.io" }],
        destination: "https://brightears.io/:path*",
        permanent: false,
      },
    ];
  },

  // Baseline security headers (P7.6, audit 2026-07: none were configured).
  // CSP is deliberately deferred: Clerk + inline JSON-LD need a curated policy;
  // shipping a hasty one breaks auth. These five are safe everywhere.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // 2 years, subdomains included — the apex serves HTTPS via Render/Cloudflare.
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // The app embeds nowhere (approve-from-phone is the PWA, not an iframe).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
