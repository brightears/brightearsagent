import { db } from "@/lib/db";
import { notifyBusiness } from "@/lib/notify";
import { reportError } from "@/lib/report-error";
import { isBlockedHost, resolvesToBlockedIp } from "@/lib/pdf/images";
import { normalizeLocale } from "@/lib/i18n/config";

/**
 * EPK freshness monitor (P12.6). The one-pager is what every pitch links to
 * — a dead photo or a 404'd optional video quietly kills conversions. Weekly
 * sweep (rides the report cron) checks the ARTIST-OWNED links (video, photos,
 * website, booking link) and nags via notifyBusiness only when something is
 * actually broken.
 *
 * Honesty discipline for link-rot: only a hard 404/410 or a dead host
 * counts as BROKEN. 403/429/timeouts are bot walls and slow hosts — flagging
 * those would train the owner to ignore the nag. Social links are skipped
 * entirely (Instagram/Facebook always wall bots).
 */

export type LinkCheck = { url: string; broken: boolean };

export async function checkUrl(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<LinkCheck> {
  // SSRF guard (P15 review): artist-supplied URLs run server-side from inside
  // the trust boundary — same discipline as the PDF image fetch. Block
  // private/loopback/metadata hosts, verify what the NAME resolves to, and
  // never follow redirects (a public host could 302 to an internal target).
  // A blocked host is not "broken" (don't nag the owner) — just unchecked.
  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    return { url, broken: false };
  }
  if (isBlockedHost(host) || (await resolvesToBlockedIp(host))) return { url, broken: false };
  try {
    let res = await fetchFn(url, {
      method: "HEAD",
      redirect: "manual",
      signal: AbortSignal.timeout(6000),
    });
    // Plenty of hosts refuse HEAD — retry once as GET before judging.
    if (res.status === 405 || res.status === 501) {
      res = await fetchFn(url, {
        method: "GET",
        redirect: "manual",
        signal: AbortSignal.timeout(6000),
      });
    }
    return { url, broken: res.status === 404 || res.status === 410 };
  } catch (err) {
    // DNS failure = the host itself is gone → broken. Timeouts/aborts = unknown.
    const message = (err as Error & { cause?: { code?: string } })?.cause?.code ?? "";
    return { url, broken: message === "ENOTFOUND" };
  }
}

export type FreshnessReport = {
  businessId: string;
  brokenLinks: string[];
};

export async function checkEpkFreshness(
  business: {
    id: string;
    videoLinks: string[];
    photoUrls: string[];
    websiteUrl: string | null;
    bookingLinkUrl: string | null;
  },
  fetchFn: typeof fetch = fetch,
): Promise<FreshnessReport> {
  const urls = [
    ...business.videoLinks,
    ...business.photoUrls,
    business.websiteUrl,
    business.bookingLinkUrl,
  ].filter((u): u is string => !!u && /^https?:\/\//i.test(u));

  const checks = await Promise.all(urls.map((u) => checkUrl(u, fetchFn)));

  return {
    businessId: business.id,
    brokenLinks: checks.filter((c) => c.broken).map((c) => c.url),
  };
}

/** Weekly sweep over EPK-enabled paying tenants; per-tenant failures isolated. */
export async function runEpkFreshnessSweep(
  fetchFn: typeof fetch = fetch,
): Promise<{ checked: number; nagged: number; failed: number }> {
  const businesses = await db.business.findMany({
    where: { epkEnabled: true, plan: { not: "TRIAL" } },
  });

  let nagged = 0;
  let failed = 0;
  for (const business of businesses) {
    try {
      const report = await checkEpkFreshness(business, fetchFn);
      if (report.brokenLinks.length === 0) continue;

      const thai = normalizeLocale(business.locale) === "th";
      const problems = report.brokenLinks.map((u) => thai ? `ลิงก์เสีย (ไม่พบหน้า): ${u}` : `Broken link (page not found): ${u}`);
      await notifyBusiness(business, {
        title: thai ? "เพรสคิตของคุณมีลิงก์ที่ต้องแก้ไข" : "Your one-pager needs a touch-up",
        body: thai
          ? `พบลิงก์เสีย ${report.brokenLinks.length} ลิงก์บนเพจของคุณ`
          : `${report.brokenLinks.length} link${report.brokenLinks.length === 1 ? " is" : "s are"} dead on your page.`,
        url: "/dashboard/settings#profile",
        emailBody: thai
          ? `ข้อความแนะนำตัวทุกฉบับลิงก์ไปยังเพรสคิตของคุณ และการตรวจสัปดาห์นี้พบ:\n\n${problems.map((p) => `- ${p}`).join("\n")}\n\nแก้ไขได้ในห้องควบคุม`
          : `Your one-pager is what every pitch links to — and this week's check found:\n\n${problems.map((p) => `- ${p}`).join("\n")}\n\nTwo minutes in the Control room fixes it.`,
      });
      nagged++;
    } catch (err) {
      failed++;
      void reportError(err, { kind: "epk-freshness", businessId: business.id });
    }
  }
  return { checked: businesses.length, nagged, failed };
}
