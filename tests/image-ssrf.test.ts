import { describe, it, expect } from "vitest";
import { isBlockedHost } from "@/lib/pdf/images";

describe("isBlockedHost (SSRF guard for tenant-supplied image URLs)", () => {
  it("blocks loopback / localhost / private / link-local / metadata hosts", () => {
    for (const h of [
      "localhost", "app.localhost", "thing.local", "svc.internal",
      "127.0.0.1", "0.0.0.0", "10.1.2.3", "172.16.0.1", "172.31.255.1",
      "192.168.1.1", "169.254.169.254", "100.64.0.1", "::1", "fe80::1", "fd00::1",
    ]) {
      expect(isBlockedHost(h), h).toBe(true);
    }
  });

  it("allows public hosts (the artist's real CDN/site)", () => {
    for (const h of [
      "pub-abc.r2.dev", "instagram.com", "i.imgur.com", "example.com",
      "172.32.0.1", "8.8.8.8", "192.169.0.1",
    ]) {
      expect(isBlockedHost(h), h).toBe(false);
    }
  });
});
