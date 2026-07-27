import { describe, it, expect } from "vitest";
import { canonicalRedirectTarget } from "@/lib/canonical-host";

const APEX = "https://brightears.io";
const OLD = "brightears-app.onrender.com";

const req = (over: Partial<Parameters<typeof canonicalRedirectTarget>[0]> = {}) =>
  canonicalRedirectTarget({
    method: "GET",
    pathname: "/pricing",
    search: "",
    host: OLD,
    appUrl: APEX,
    ...over,
  });

describe("canonicalRedirectTarget — post-cutover canonicalization", () => {
  it("sends a stale onrender page GET to the apex, preserving path and query", () => {
    expect(req({ pathname: "/compare/the-knot", search: "?utm=x" })).toBe(
      "https://brightears.io/compare/the-knot?utm=x",
    );
  });

  it("is a no-op before cutover, when APP_URL IS the onrender host", () => {
    expect(req({ appUrl: "https://brightears-app.onrender.com" })).toBeNull();
  });

  it("never fires on the canonical host itself (no redirect loop)", () => {
    expect(req({ host: "brightears.io" })).toBeNull();
  });

  it("ignores the port on the incoming host", () => {
    expect(req({ host: `${OLD}:443` })).toBe("https://brightears.io/pricing");
  });
});

// These four are the reason the function exists as its own module: each one is
// a real integration that silently dies if canonicalization is too greedy.
describe("canonicalRedirectTarget — exemptions that keep integrations alive", () => {
  it("NEVER redirects /api — a 301 would gut Postmark's inbound parse", () => {
    expect(req({ method: "POST", pathname: "/api/inbound" })).toBeNull();
    expect(req({ pathname: "/api/inbound" })).toBeNull(); // even on GET
  });

  it("NEVER redirects the Stripe webhook — Stripe does not follow redirects", () => {
    expect(req({ method: "POST", pathname: "/api/webhooks/stripe" })).toBeNull();
  });

  it("NEVER redirects cron endpoints — cross-origin strips Authorization", () => {
    expect(req({ pathname: "/api/cron/sequences", search: "?secret=abc" })).toBeNull();
  });

  it("NEVER redirects a non-GET page request — server actions POST to the page url", () => {
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(req({ method, pathname: "/onboarding" }), method).toBeNull();
    }
  });

  it("allows HEAD (uptime probes) to canonicalize like GET", () => {
    expect(req({ method: "HEAD" })).toBe("https://brightears.io/pricing");
  });
});

describe("canonicalRedirectTarget — fails safe", () => {
  it("does nothing when APP_URL is unset rather than crashing every request", () => {
    expect(req({ appUrl: undefined })).toBeNull();
  });

  it("does nothing when APP_URL is malformed", () => {
    expect(req({ appUrl: "not a url" })).toBeNull();
  });

  it("leaves hosts that are not the render subdomain alone", () => {
    expect(req({ host: "agency.brightears.io" })).toBeNull();
    expect(req({ host: "" })).toBeNull();
  });
});
