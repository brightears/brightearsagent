import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer pulls in native-ish deps (yoga wasm, fontkit) that must
  // not pass through the bundler — keep it external so it's required at runtime.
  serverExternalPackages: ["@react-pdf/renderer"],

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
